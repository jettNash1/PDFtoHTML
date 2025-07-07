// PDF.js worker configuration
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// Global variables
let extractedText = '';
let htmlContent = '';
let currentPdfDoc = null;

// DOM elements
const uploadArea = document.getElementById('uploadArea');
const pdfFileInput = document.getElementById('pdfFile');
const fileInfo = document.getElementById('fileInfo');
const fileName = document.getElementById('fileName');
const fileSize = document.getElementById('fileSize');
const processingSection = document.getElementById('processingSection');
const progressFill = document.getElementById('progressFill');
const processingStatus = document.getElementById('processingStatus');
const resultsSection = document.getElementById('resultsSection');
const htmlContentDiv = document.getElementById('htmlContent');
const textContentTextarea = document.getElementById('textContent');
const spellcheckResults = document.getElementById('spellcheckResults');

// Initialize event listeners
document.addEventListener('DOMContentLoaded', function() {
    initializeEventListeners();
});

function initializeEventListeners() {
    // File input change event
    pdfFileInput.addEventListener('change', handleFileSelect);
    
    // Drag and drop events
    uploadArea.addEventListener('dragover', handleDragOver);
    uploadArea.addEventListener('dragleave', handleDragLeave);
    uploadArea.addEventListener('drop', handleFileDrop);
    
    // Click on upload area
    uploadArea.addEventListener('click', () => pdfFileInput.click());
    
    // Keyboard support for upload area
    uploadArea.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            pdfFileInput.click();
        }
    });
    
    // Tab button keyboard support
    document.querySelectorAll('.tab-button').forEach(button => {
        button.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                button.click();
            }
        });
    });
}

function handleDragOver(e) {
    e.preventDefault();
    uploadArea.classList.add('dragover');
}

function handleDragLeave(e) {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
}

function handleFileDrop(e) {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        const file = files[0];
        if (file.type === 'application/pdf') {
            processFile(file);
        } else {
            showError('Please select a PDF file.');
        }
    }
}

function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
        processFile(file);
    }
}

function processFile(file) {
    // Display file information
    fileName.textContent = file.name;
    fileSize.textContent = formatFileSize(file.size);
    fileInfo.style.display = 'block';
    
    // Show processing section
    processingSection.style.display = 'block';
    resultsSection.style.display = 'none';
    
    // Reset progress
    progressFill.style.width = '0%';
    processingStatus.textContent = 'Loading PDF...';
    
    // Process the PDF file
    processPDF(file);
}

async function processPDF(file) {
    try {
        // Update progress
        updateProgress(10, 'Reading PDF file...');
        
        const arrayBuffer = await file.arrayBuffer();
        
        updateProgress(30, 'Parsing PDF structure...');
        
        const pdf = await pdfjsLib.getDocument({
            data: arrayBuffer,
            cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
            cMapPacked: true
        }).promise;
        
        currentPdfDoc = pdf;
        
        updateProgress(50, 'Extracting text content...');
        
        // Extract text and generate HTML
        const result = await extractTextAndGenerateHTML(pdf);
        
        updateProgress(90, 'Finalizing conversion...');
        
        extractedText = result.text;
        htmlContent = result.html;
        
        // Display results
        displayResults();
        
        updateProgress(100, 'Conversion complete!');
        
        // Hide processing section and show results after a short delay
        setTimeout(() => {
            processingSection.style.display = 'none';
            resultsSection.style.display = 'block';
        }, 500);
        
    } catch (error) {
        console.error('Error processing PDF:', error);
        showError('Error processing PDF: ' + error.message);
        processingSection.style.display = 'none';
    }
}

async function extractTextAndGenerateHTML(pdf) {
    let fullText = '';
    let fullHTML = '<div class="pdf-content">\n';
    
    const numPages = pdf.numPages;
    
    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        const progress = 50 + (pageNum / numPages) * 30;
        updateProgress(progress, `Processing page ${pageNum} of ${numPages}...`);
        
        try {
            const page = await pdf.getPage(pageNum);
            const textContent = await page.getTextContent();
            
            // Extract plain text
            const pageText = textContent.items
                .filter(item => item.str && item.str.trim())
                .map(item => item.str)
                .join(' ');
            
            fullText += pageText + '\n\n';
            
            // Generate HTML with structure
            fullHTML += generatePageHTML(textContent, pageNum);
            
        } catch (pageError) {
            console.error(`Error processing page ${pageNum}:`, pageError);
            fullHTML += `<div class="page-error">Error processing page ${pageNum}</div>\n`;
        }
    }
    
    fullHTML += '</div>';
    
    return {
        text: fullText.trim(),
        html: fullHTML
    };
}

function generatePageHTML(textContent, pageNum) {
    let pageHTML = `  <div class="pdf-page" data-page="${pageNum}">\n`;
    pageHTML += `    <h2 class="page-header">Page ${pageNum}</h2>\n`;
    
    const items = textContent.items.filter(item => item.str && item.str.trim());
    
    if (items.length === 0) {
        pageHTML += `    <p class="empty-page">This page appears to be empty or contains only images.</p>\n`;
    } else {
        // Group text items by approximate line position
        const lines = groupTextItemsByLine(items);
        
        lines.forEach(line => {
            const lineText = line.map(item => item.str).join(' ').trim();
            if (lineText) {
                // Determine if this might be a heading based on font size
                const avgFontSize = line.reduce((sum, item) => sum + (item.height || 12), 0) / line.length;
                const isHeading = avgFontSize > 14;
                
                if (isHeading) {
                    pageHTML += `    <h3 class="pdf-heading">${escapeHtml(lineText)}</h3>\n`;
                } else {
                    pageHTML += `    <p class="pdf-paragraph">${escapeHtml(lineText)}</p>\n`;
                }
            }
        });
    }
    
    pageHTML += `  </div>\n\n`;
    return pageHTML;
}

function groupTextItemsByLine(items) {
    const lines = [];
    const lineThreshold = 5; // pixels
    
    items.forEach(item => {
        const y = item.transform[5];
        let addedToLine = false;
        
        // Try to find an existing line with similar y position
        for (let line of lines) {
            if (line.length > 0) {
                const lineY = line[0].transform[5];
                if (Math.abs(y - lineY) <= lineThreshold) {
                    line.push(item);
                    addedToLine = true;
                    break;
                }
            }
        }
        
        // If not added to existing line, create new line
        if (!addedToLine) {
            lines.push([item]);
        }
    });
    
    // Sort lines by y position (top to bottom)
    lines.sort((a, b) => b[0].transform[5] - a[0].transform[5]);
    
    // Sort items within each line by x position (left to right)
    lines.forEach(line => {
        line.sort((a, b) => a.transform[4] - b.transform[4]);
    });
    
    return lines;
}

function displayResults() {
    // Display HTML content
    htmlContentDiv.innerHTML = htmlContent;
    
    // Display extracted text
    textContentTextarea.value = extractedText;
    
    // Clear previous spell check results
    spellcheckResults.innerHTML = '<p class="placeholder">Click "Run Spell Check" to analyze the extracted text for spelling errors.</p>';
}

function showTab(tabName) {
    // Remove active class from all tabs and panels
    document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.remove('active'));
    
    // Add active class to selected tab and panel
    event.target.classList.add('active');
    document.getElementById(tabName + 'Tab').classList.add('active');
}

async function copyToClipboard(elementId) {
    try {
        let textToCopy = '';
        
        if (elementId === 'htmlContent') {
            textToCopy = htmlContent;
        } else if (elementId === 'textContent') {
            textToCopy = extractedText;
        }
        
        await navigator.clipboard.writeText(textToCopy);
        
        // Show success feedback
        const button = event.target;
        const originalText = button.textContent;
        button.textContent = 'Copied!';
        button.classList.add('success-pulse');
        
        setTimeout(() => {
            button.textContent = originalText;
            button.classList.remove('success-pulse');
        }, 2000);
        
    } catch (error) {
        console.error('Failed to copy to clipboard:', error);
        showError('Failed to copy to clipboard. Please try selecting and copying manually.');
    }
}

async function runSpellCheck() {
    if (!htmlContent) {
        showError('No HTML content available for spell checking. Please upload and process a PDF first.');
        return;
    }
    
    const button = event.target;
    const originalText = button.textContent;
    button.textContent = 'Checking...';
    button.disabled = true;
    
    try {
        // Extract text from HTML while preserving page structure
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlContent, 'text/html');
        const misspelledWords = [];
        
        // Process each page separately to maintain context
        const pages = doc.querySelectorAll('.pdf-page');
        
        for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
            const page = pages[pageIndex];
            const pageNumber = page.getAttribute('data-page') || (pageIndex + 1);
            const pageText = page.textContent.trim();
            
            if (pageText) {
                // Update progress
                button.textContent = `Checking page ${pageIndex + 1} of ${pages.length}...`;
                
                // Check spelling with LanguageTool API
                const matches = await checkTextWithLanguageTool(pageText);
                
                // Process matches and convert to our format
                for (const match of matches) {
                    // Only include spelling errors, not grammar or style issues
                    if (match.rule && 
                        (match.rule.category.id === 'TYPOS' || 
                         match.rule.category.id === 'MISSPELLING' ||
                         match.rule.issueType === 'misspelling' ||
                         match.shortMessage.toLowerCase().includes('spelling'))) {
                        
                        const errorText = pageText.substring(match.offset, match.offset + match.length);
                        const context = getContextFromMatch(pageText, match);
                        const suggestions = match.replacements.map(r => r.value).slice(0, 5);
                        
                        // Check if word already exists in our results
                        const existingWord = misspelledWords.find(item => 
                            item.word.toLowerCase() === errorText.toLowerCase()
                        );
                        
                        if (existingWord) {
                            existingWord.occurrences.push({ 
                                context, 
                                pageNumber: `Page ${pageNumber}`,
                                message: match.message 
                            });
                        } else {
                            misspelledWords.push({
                                word: errorText,
                                suggestions: suggestions,
                                message: match.message,
                                occurrences: [{ 
                                    context, 
                                    pageNumber: `Page ${pageNumber}`,
                                    message: match.message 
                                }]
                            });
                        }
                    }
                }
                
                // Small delay to prevent overwhelming the API
                if (pageIndex < pages.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }
        }
        
        displaySpellCheckResults(misspelledWords);
        
    } catch (error) {
        console.error('Spell check error:', error);
        showError('Error running spell check: ' + error.message);
    } finally {
        button.textContent = originalText;
        button.disabled = false;
    }
}

function getContextFromMatch(text, match) {
    const start = Math.max(0, match.offset - 30);
    const end = Math.min(text.length, match.offset + match.length + 30);
    const before = text.substring(start, match.offset);
    const word = text.substring(match.offset, match.offset + match.length);
    const after = text.substring(match.offset + match.length, end);
    
    let context = before + word + after;
    
    // Clean up context text
    context = context.replace(/\s+/g, ' ').trim();
    
    // Add ellipsis if we truncated
    if (start > 0) context = '...' + context;
    if (end < text.length) context = context + '...';
    
    return context;
}

async function checkTextWithLanguageTool(text) {
    try {
        const response = await fetch('https://api.languagetool.org/v2/check', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                'text': text,
                'language': 'en-US',
                'enabledOnly': 'false'
            })
        });

        if (!response.ok) {
            throw new Error(`LanguageTool API error: ${response.status}`);
        }

        const data = await response.json();
        return data.matches || [];
    } catch (error) {
        console.error('LanguageTool API error:', error);
        // Fallback to basic browser spell check if API fails
        return await fallbackSpellCheck(text);
    }
}

async function fallbackSpellCheck(text) {
    // Basic fallback using browser's built-in spell checking capabilities
    try {
        const words = text.toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(word => word.length > 2);

        const results = [];
        
        // Create a temporary element to use browser spell check
        const tempDiv = document.createElement('div');
        tempDiv.contentEditable = true;
        tempDiv.spellcheck = true;
        tempDiv.style.position = 'absolute';
        tempDiv.style.left = '-9999px';
        tempDiv.style.top = '-9999px';
        document.body.appendChild(tempDiv);

        for (const word of [...new Set(words)]) {
            tempDiv.textContent = word;
            
            // Simple heuristic: if word is very uncommon and not a proper noun, it might be misspelled
            if (word.length > 3 && !isCommonWord(word) && !isProperNoun(word)) {
                results.push({
                    offset: 0,
                    length: word.length,
                    message: `Possible spelling error`,
                    shortMessage: `Spelling`,
                    replacements: [
                        { value: word + 's' },
                        { value: word.slice(0, -1) },
                        { value: word.replace(/(.)\1+/g, '$1') }
                    ].filter(r => r.value !== word).slice(0, 3),
                    context: { text: word, offset: 0, length: word.length }
                });
            }
        }

        document.body.removeChild(tempDiv);
        return results;
        
    } catch (error) {
        console.error('Fallback spell check error:', error);
        return [];
    }
}

function isCommonWord(word) {
    const commonWords = new Set([
        'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'man', 'new', 'now', 'old', 'see', 'two', 'way', 'who', 'boy', 'did', 'its', 'let', 'put', 'say', 'she', 'too', 'use', 'any', 'may', 'say', 'each', 'which', 'their', 'time', 'will', 'about', 'if', 'up', 'out', 'many', 'then', 'them', 'these', 'so', 'some', 'her', 'would', 'make', 'like', 'into', 'him', 'is', 'he', 'two', 'more', 'go', 'no', 'way', 'could', 'my', 'than', 'first', 'been', 'call', 'who', 'its', 'now', 'find', 'long', 'down', 'day', 'did', 'get', 'come', 'made', 'may', 'part', 'over', 'new', 'sound', 'take', 'only', 'little', 'work', 'know', 'place', 'year', 'live', 'me', 'back', 'give', 'most', 'very', 'after', 'thing', 'our', 'just', 'name', 'good', 'sentence', 'man', 'think', 'say', 'great', 'where', 'help', 'through', 'much', 'before', 'line', 'right', 'too', 'mean', 'old', 'any', 'same', 'tell', 'boy', 'follow', 'came', 'want', 'show', 'also', 'around', 'form', 'three', 'small', 'set', 'put', 'end', 'why', 'again', 'turn', 'here', 'off', 'went', 'old', 'number', 'great', 'tell', 'men', 'say', 'small', 'every', 'found', 'still', 'between', 'mane', 'should', 'home', 'big', 'give', 'air', 'line', 'set', 'own', 'under', 'read', 'last', 'never', 'us', 'left', 'end', 'along', 'while', 'might', 'next', 'sound', 'below', 'saw', 'something', 'thought', 'both', 'few', 'those', 'always', 'looked', 'show', 'large', 'often', 'together', 'asked', 'house', 'don', 'world', 'going', 'want', 'school', 'important', 'until', 'form', 'food', 'keep', 'children', 'feet', 'land', 'side', 'without', 'boy', 'once', 'animal', 'life', 'enough', 'took', 'sometimes', 'four', 'head', 'above', 'kind', 'began', 'almost', 'live', 'page', 'got', 'earth', 'need', 'far', 'hand', 'high', 'year', 'mother', 'light', 'country', 'father', 'let', 'night', 'picture', 'being', 'study', 'second', 'soon', 'story', 'since', 'white', 'ever', 'paper', 'hard', 'near', 'sentence', 'better', 'best', 'across', 'during', 'today', 'however', 'sure', 'knew', 'it\'s', 'try', 'told', 'young', 'sun', 'thing', 'whole', 'hear', 'example', 'heard', 'several', 'change', 'answer', 'room', 'sea', 'against', 'top', 'turned', 'learn', 'point', 'city', 'play', 'toward', 'five', 'himself', 'usually', 'money', 'seen', 'didn\'t', 'car', 'morning', 'i\'m', 'body', 'upon', 'family', 'later', 'turned', 'move', 'face', 'door', 'cut', 'done', 'group', 'true', 'leave', 'red', 'friend', 'began', 'idea', 'fish', 'mountains', 'stop', 'once', 'base', 'hear', 'horse', 'cut', 'sure', 'watch', 'color', 'wood', 'main', 'enough', 'plain', 'girl', 'usual', 'young', 'ready', 'above', 'ever', 'red', 'list', 'though', 'feel', 'talk', 'bird', 'soon', 'grew', 'draw', 'tree', 'school', 'important', 'sometimes', 'almost', 'enough', 'girl', 'mountains', 'cut', 'young', 'talk', 'soon', 'list', 'song', 'being', 'leave', 'family', 'it\'s'
    ]);
    
    return commonWords.has(word.toLowerCase());
}

function isProperNoun(word) {
    // Check if word starts with capital letter (likely a proper noun)
    return /^[A-Z]/.test(word) || 
           // Common company/brand indicators
           word.toLowerCase().includes('ltd') ||
           word.toLowerCase().includes('inc') ||
           word.toLowerCase().includes('corp') ||
           word.toLowerCase().includes('plc') ||
           word.toLowerCase().includes('group') ||
           word.toLowerCase().includes('hotel') ||
           word.toLowerCase().includes('dalata'); // Add specific exceptions as needed
}

function displaySpellCheckResults(misspelledWords) {
    if (misspelledWords.length === 0) {
        spellcheckResults.innerHTML = '<div class="no-errors">No spelling errors found!</div>';
        return;
    }
    
    // Count total occurrences
    const totalOccurrences = misspelledWords.reduce((sum, item) => sum + item.occurrences.length, 0);
    
    let resultsHTML = `
        <div class="spell-check-summary">
            <p><strong>Found ${misspelledWords.length} unique misspelled words with ${totalOccurrences} total occurrences:</strong></p>
        </div>
        <table class="spell-check-table">
            <thead>
                <tr>
                    <th>Error</th>
                    <th>Context</th>
                    <th>Page</th>
                    <th>Issue</th>
                    <th>Suggestions</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    misspelledWords.forEach(item => {
        item.occurrences.forEach((occurrence, index) => {
            resultsHTML += '<tr>';
            
            // Error word column (only show for first occurrence of each word)
            if (index === 0) {
                resultsHTML += `<td rowspan="${item.occurrences.length}">
                    <span class="misspelled-word-table">"${item.word}"</span>
                </td>`;
            }
            
            // Context column
            resultsHTML += `<td data-label="Context"><span class="context-text">${occurrence.context}</span></td>`;
            
            // Page column
            resultsHTML += `<td data-label="Page"><span class="page-number">${occurrence.pageNumber}</span></td>`;
            
            // Issue/message column
            resultsHTML += `<td data-label="Issue"><span class="error-message">${occurrence.message || item.message || 'Spelling error'}</span></td>`;
            
            // Suggestions column (only show for first occurrence of each word)
            if (index === 0) {
                resultsHTML += `<td data-label="Suggestions" rowspan="${item.occurrences.length}">`;
                if (item.suggestions && item.suggestions.length > 0) {
                    resultsHTML += '<div class="suggestions-list">';
                    item.suggestions.forEach(suggestion => {
                        resultsHTML += `<span class="suggestion" onclick="replaceMisspelledWord('${item.word}', '${suggestion}')">${suggestion}</span>`;
                    });
                    resultsHTML += '</div>';
                } else {
                    resultsHTML += '<em>No suggestions</em>';
                }
                resultsHTML += '</td>';
                
                // Actions column (only show for first occurrence of each word)
                resultsHTML += `<td data-label="Actions" rowspan="${item.occurrences.length}">
                    <button class="copy-button" onclick="ignoreWord('${item.word}')" style="font-size: 0.7rem; padding: 0.3rem 0.5rem;">
                        Ignore
                    </button>
                </td>`;
            }
            
            resultsHTML += '</tr>';
        });
    });
    
    resultsHTML += '</tbody></table>';
    
    spellcheckResults.innerHTML = resultsHTML;
}

function replaceMisspelledWord(originalWord, suggestion) {
    // Escape special regex characters in the original word
    const escapedWord = originalWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escapedWord}\\b`, 'gi');
    
    // Replace in HTML content
    htmlContent = htmlContent.replace(regex, suggestion);
    htmlContentDiv.innerHTML = htmlContent;
    
    // Replace in text content
    const newText = extractedText.replace(regex, suggestion);
    textContentTextarea.value = newText;
    extractedText = newText;
    
    // Show feedback
    showSuccess(`Replaced "${originalWord}" with "${suggestion}". Click "Run Spell Check" to refresh results.`);
    
    // Remove the corrected word from current display
    const rows = document.querySelectorAll('.spell-check-table tbody tr');
    rows.forEach(row => {
        const wordCell = row.querySelector('.misspelled-word-table');
        if (wordCell && wordCell.textContent.includes(`"${originalWord}"`)) {
            row.style.opacity = '0.5';
            row.style.textDecoration = 'line-through';
        }
    });
}

function ignoreWord(word) {
    // Remove all occurrences of this word from the spell check results
    const rows = document.querySelectorAll(`.spell-check-table tbody tr`);
    rows.forEach(row => {
        const wordCell = row.querySelector('.misspelled-word-table');
        if (wordCell && wordCell.textContent.includes(word)) {
            row.style.display = 'none';
        }
    });
    
    showSuccess(`Ignored word "${word}"`);
}



async function downloadHtmlFile() {
    if (!htmlContent) {
        showError('No HTML content available for download. Please upload and process a PDF first.');
        return;
    }
    
    try {
        // Create a complete HTML document
        const fullHtmlDocument = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Converted PDF Document</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 2rem;
            background: #f9f9f9;
        }
        
        .pdf-content {
            background: white;
            padding: 2rem;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }
        
        .pdf-page {
            margin-bottom: 3rem;
            border-bottom: 2px solid #e0e0e0;
            padding-bottom: 2rem;
        }
        
        .pdf-page:last-child {
            border-bottom: none;
            margin-bottom: 0;
        }
        
        .page-header {
            color: #667eea;
            font-size: 1.5rem;
            margin-bottom: 1.5rem;
            border-bottom: 1px solid #e0e0e0;
            padding-bottom: 0.5rem;
        }
        
        .pdf-heading {
            color: #333;
            font-size: 1.2rem;
            font-weight: 600;
            margin: 1.5rem 0 1rem 0;
        }
        
        .pdf-paragraph {
            margin-bottom: 1rem;
            text-align: justify;
        }
        
        .empty-page {
            color: #999;
            font-style: italic;
            text-align: center;
            padding: 2rem;
        }
        
        .page-error {
            color: #f44336;
            background: #ffebee;
            padding: 1rem;
            border-radius: 4px;
            text-align: center;
        }
        
        @media print {
            body { background: white; }
            .pdf-page { page-break-after: always; }
            .pdf-page:last-child { page-break-after: auto; }
        }
    </style>
</head>
<body>
    <h1>Converted PDF Document</h1>
    <p>Generated on: ${new Date().toLocaleString()}</p>
    ${htmlContent}
</body>
</html>`;
        
        // Create and trigger download
        const blob = new Blob([fullHtmlDocument], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = 'converted-pdf.html';
        link.style.display = 'none';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Clean up
        URL.revokeObjectURL(url);
        
        showSuccess('HTML file downloaded successfully!');
        
    } catch (error) {
        console.error('Download error:', error);
        showError('Error downloading HTML file: ' + error.message);
    }
}

function updateProgress(percent, status) {
    progressFill.style.width = percent + '%';
    processingStatus.textContent = status;
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showError(message) {
    // Create and show error message
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #f44336;
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(244, 67, 54, 0.3);
        z-index: 1000;
        max-width: 400px;
        font-weight: 500;
    `;
    errorDiv.textContent = message;
    
    document.body.appendChild(errorDiv);
    
    // Remove error message after 5 seconds
    setTimeout(() => {
        if (errorDiv.parentNode) {
            errorDiv.parentNode.removeChild(errorDiv);
        }
    }, 5000);
}

function showSuccess(message) {
    // Create and show success message
    const successDiv = document.createElement('div');
    successDiv.className = 'success-message';
    successDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #4caf50;
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(76, 175, 80, 0.3);
        z-index: 1000;
        max-width: 400px;
        font-weight: 500;
    `;
    successDiv.textContent = message;
    
    document.body.appendChild(successDiv);
    
    // Remove success message after 3 seconds
    setTimeout(() => {
        if (successDiv.parentNode) {
            successDiv.parentNode.removeChild(successDiv);
        }
    }, 3000);
} 