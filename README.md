# PDF to HTML Converter with Advanced Spell Checker

A modern, client-side web application that converts PDF files to HTML format and provides professional text extraction with advanced spell checking capabilities using LanguageTool API.

## Features

✅ **PDF Upload**: Drag & drop or click to upload PDF files  
✅ **HTML Conversion**: Converts PDF content to structured HTML  
✅ **HTML Download**: Download complete, styled HTML files  
✅ **Text Extraction**: Extracts plain text from PDF documents  
✅ **Professional Spell Checking**: Uses LanguageTool API for accurate spell checking  
✅ **Responsive Design**: Works on desktop, tablet, and mobile devices  
✅ **Accessibility**: Full keyboard navigation and screen reader support  
✅ **Copy to Clipboard**: Easy copying of HTML and text content  
✅ **Progress Tracking**: Real-time processing progress indicators  

## Key Improvements

### Advanced Spell Checking
- **Professional API**: Now uses LanguageTool API instead of basic word checking
- **Smart Detection**: Properly recognizes company names like "Dalata" and doesn't flag them
- **Quality Suggestions**: Provides contextually relevant corrections (no more "Aevleopment" nonsense!)
- **Detailed Errors**: Shows exactly why each word was flagged with explanations
- **Fallback System**: Works even when offline with intelligent fallback

### Enhanced Features
- **HTML Download**: Get a complete, styled HTML file of your converted PDF
- **Better Table Display**: Professional error table with context, page numbers, and explanations
- **Smart Filtering**: Automatically ignores proper nouns, company names, and technical terms

## How to Use

1. **Open `index.html`** in your web browser
2. **Upload a PDF** by dragging & dropping or clicking the upload area
3. **Wait for processing** - progress will be shown with status updates
4. **View results** in three tabs:
   - **HTML Content**: Structured HTML with download button
   - **Extracted Text**: Plain text for manual review
   - **Spell Check**: Professional error analysis with detailed table

## Technical Details

- **LanguageTool API**: Industry-standard spell checking service
- **PDF.js**: Client-side PDF processing (no server needed)
- **Responsive Design**: Works on all devices
- **Privacy-First**: PDFs never leave your device (only text sent for spell checking)

## Limitations

- **API Dependency**: Spell checking requires internet connection (fallback available)
- **Rate Limiting**: LanguageTool free tier allows 20 requests/minute
- **Text-Only**: Images and complex graphics are not converted

## Getting Started

Simply open `index.html` in any modern web browser and start converting PDFs!
