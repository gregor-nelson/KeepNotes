// ==============================================================================
// RichTextEditor - Standalone Rich Text Editor Class
// Extracted from KeepNote UIManager for better organization
// ==============================================================================

class RichTextEditor {
    constructor(editorElement, toolbarElement) {
        this.editor = editorElement;
        this.toolbar = toolbarElement;
        this.customScrollbar = null;
        
        if (!this.editor || !this.toolbar) {
            throw new Error('RichTextEditor requires both editor and toolbar elements');
        }
        
        this.init();
    }
    
    init() {
        this.attachToolbarListeners();
        this.attachKeyboardShortcuts();
        this.initializeCustomScrollbar();
        this.attachDropdownListeners();
    }
    
    // ==== CORE API METHODS ====
    setContent(htmlContent) {
        this.editor.innerHTML = htmlContent || '';
        this.updateScrollbar();
    }
    
    getContent() {
        return this.editor.innerHTML.trim();
    }
    
    focus() {
        this.editor.focus();
    }
    
    updateScrollbar() {
        if (this.customScrollbar) {
            this.customScrollbar.updateScrollbar();
        }
    }
    
    // ==== TOOLBAR EVENT HANDLING ====
    attachToolbarListeners() {
        if (!this.toolbar) return;
        
        // Add click listeners to all toolbar buttons
        this.toolbar.addEventListener('click', (e) => {
            const button = e.target.closest('.toolbar-button');
            const dropdownItem = e.target.closest('.dropdown-item');
            
            if (dropdownItem) {
                e.preventDefault();
                e.stopPropagation();
                const command = dropdownItem.dataset.command;
                this.executeCommand(command);
                
                // Close dropdown
                const dropdown = dropdownItem.closest('.dropdown');
                if (dropdown) {
                    dropdown.classList.remove('active');
                }
                return;
            }
            
            if (button && !button.classList.contains('dropdown-toggle')) {
                e.preventDefault();
                const command = button.dataset.command;
                this.executeCommand(command);
            }
        });
        
        // Update toolbar states when selection changes
        this.editor.addEventListener('keyup', () => this.updateToolbarStates());
        this.editor.addEventListener('mouseup', () => this.updateToolbarStates());
    }
    
    attachDropdownListeners() {
        // Handle dropdown toggles
        const dropdownToggles = this.toolbar.querySelectorAll('.dropdown-toggle');
        dropdownToggles.forEach(toggle => {
            toggle.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                const dropdown = toggle.closest('.dropdown');
                const isActive = dropdown.classList.contains('active');
                
                // Close all other dropdowns
                this.toolbar.querySelectorAll('.dropdown.active').forEach(d => {
                    d.classList.remove('active');
                });
                
                // Toggle current dropdown
                if (!isActive) {
                    dropdown.classList.add('active');
                    this.positionDropdown(dropdown);
                }
            });
        });
        
        // Close dropdowns when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.dropdown')) {
                this.toolbar.querySelectorAll('.dropdown.active').forEach(d => {
                    d.classList.remove('active');
                });
            }
        });
        
        // Close dropdowns on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.toolbar.querySelectorAll('.dropdown.active').forEach(d => {
                    d.classList.remove('active');
                });
            }
        });
    }
    
    positionDropdown(dropdown) {
        const menu = dropdown.querySelector('.dropdown-menu');
        const toggle = dropdown.querySelector('.dropdown-toggle');
        
        if (!menu || !toggle) return;
        
        // Reset positioning classes
        menu.classList.remove('position-above', 'position-below');
        
        // Get positions and dimensions
        const toolbarRect = this.toolbar.getBoundingClientRect();
        const toggleRect = toggle.getBoundingClientRect();
        const modalContent = document.querySelector('.modal-content');
        
        if (!modalContent) return;
        const modalRect = modalContent.getBoundingClientRect();
        
        // Temporarily show menu to get dimensions
        menu.style.visibility = 'hidden';
        menu.style.display = 'block';
        const menuRect = menu.getBoundingClientRect();
        menu.style.visibility = '';
        menu.style.display = '';
        
        // Calculate space above and below the toolbar
        const spaceAbove = toolbarRect.top - modalRect.top;
        const spaceBelow = modalRect.bottom - toolbarRect.bottom;
        
        // Determine best position (prefer above, but use below if not enough space)
        if (spaceAbove >= menuRect.height + 10) {
            // Enough space above - keep default upward position
            menu.classList.add('position-above');
        } else if (spaceBelow >= menuRect.height + 10) {
            // Not enough space above, but enough below
            menu.classList.add('position-below');
        } else {
            // Not enough space in either direction - use above and let it scroll if needed
            menu.classList.add('position-above');
        }
        
        // Adjust horizontal positioning if menu would go off-screen
        const menuLeft = toggleRect.left;
        const menuRight = menuLeft + menuRect.width;
        const modalRight = modalRect.right - 10; // 10px margin
        
        if (menuRight > modalRight) {
            const offset = menuRight - modalRight;
            menu.style.left = `-${offset}px`;
        } else {
            menu.style.left = '0';
        }
    }
    
    // ==== KEYBOARD SHORTCUTS ====
    attachKeyboardShortcuts() {
        this.editor.addEventListener('keydown', (e) => {
            // Bold - Ctrl+B
            if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
                e.preventDefault();
                this.executeCommand('bold');
            }
            
            // Italic - Ctrl+I
            if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
                e.preventDefault();
                this.executeCommand('italic');
            }
            
            // Underline - Ctrl+U
            if ((e.ctrlKey || e.metaKey) && e.key === 'u') {
                e.preventDefault();
                this.executeCommand('underline');
            }
            
            // Strikethrough - Ctrl+Shift+X
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'X') {
                e.preventDefault();
                this.executeCommand('strikethrough');
            }
            
            // Code - Ctrl+Shift+C
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'C') {
                e.preventDefault();
                this.executeCommand('code');
            }
            
            // Alternative code block - Ctrl+Alt+C (for pasted content)
            if ((e.ctrlKey || e.metaKey) && e.altKey && e.key === 'c') {
                e.preventDefault();
                this.convertToCodeBlock();
            }
            
            // Link - Ctrl+K
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                this.executeCommand('createLink');
            }
            
            // Bullet list - Ctrl+Shift+L
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'L') {
                e.preventDefault();
                this.executeCommand('insertUnorderedList');
            }
            
            // Numbered list - Ctrl+Shift+N
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'N') {
                e.preventDefault();
                this.executeCommand('insertOrderedList');
            }
            
            // Checkbox list - Ctrl+Shift+T
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'T') {
                e.preventDefault();
                this.executeCommand('insertCheckboxList');
            }
            
            // Indent - Tab
            if (e.key === 'Tab' && !e.shiftKey) {
                e.preventDefault();
                this.executeCommand('indent');
            }
            
            // Outdent - Shift+Tab
            if (e.key === 'Tab' && e.shiftKey) {
                e.preventDefault();
                this.executeCommand('outdent');
            }
            
            // Undo - Ctrl+Z
            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                this.executeCommand('undo');
            }
            
            // Redo - Ctrl+Y or Ctrl+Shift+Z
            if (((e.ctrlKey || e.metaKey) && e.key === 'y') || 
                ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'Z')) {
                e.preventDefault();
                this.executeCommand('redo');
            }
        });
    }
    
    // ==== COMMAND EXECUTION ====
    executeCommand(command) {
        if (!this.editor) return;
        
        this.editor.focus();
        
        try {
            switch(command) {
                case 'bold':
                    document.execCommand('bold', false, null);
                    break;
                case 'italic':
                    document.execCommand('italic', false, null);
                    break;
                case 'underline':
                    document.execCommand('underline', false, null);
                    break;
                case 'strikethrough':
                    document.execCommand('strikethrough', false, null);
                    break;
                case 'code':
                    this.insertCodeBlock();
                    break;
                case 'insertUnorderedList':
                    document.execCommand('insertUnorderedList', false, null);
                    break;
                case 'insertOrderedList':
                    document.execCommand('insertOrderedList', false, null);
                    break;
                case 'insertCheckboxList':
                    this.insertCheckboxList();
                    break;
                case 'createLink':
                    this.createLink();
                    break;
                case 'highlightYellow':
                    this.highlightText('#fff475');
                    break;
                case 'highlightGreen':
                    this.highlightText('#ccff90');
                    break;
                case 'highlightBlue':
                    this.highlightText('#aecbfa');
                    break;
                case 'highlightPink':
                    this.highlightText('#f28b82');
                    break;
                case 'removeHighlight':
                    this.removeHighlight();
                    break;
                case 'formatH1':
                    document.execCommand('formatBlock', false, 'h1');
                    break;
                case 'formatH2':
                    document.execCommand('formatBlock', false, 'h2');
                    break;
                case 'formatH3':
                    document.execCommand('formatBlock', false, 'h3');
                    break;
                case 'formatParagraph':
                    document.execCommand('formatBlock', false, 'p');
                    break;
                case 'insertBlockquote':
                    document.execCommand('formatBlock', false, 'blockquote');
                    break;
                case 'insertHorizontalRule':
                    document.execCommand('insertHorizontalRule', false, null);
                    break;
                case 'indent':
                    document.execCommand('indent', false, null);
                    break;
                case 'outdent':
                    document.execCommand('outdent', false, null);
                    break;
                case 'increaseFontSize':
                    this.adjustFontSize(1.2);
                    break;
                case 'decreaseFontSize':
                    this.adjustFontSize(0.8);
                    break;
                case 'justifyLeft':
                    document.execCommand('justifyLeft', false, null);
                    break;
                case 'justifyCenter':
                    document.execCommand('justifyCenter', false, null);
                    break;
                case 'justifyRight':
                    document.execCommand('justifyRight', false, null);
                    break;
                case 'undo':
                    document.execCommand('undo', false, null);
                    break;
                case 'redo':
                    document.execCommand('redo', false, null);
                    break;
                case 'removeFormat':
                    document.execCommand('removeFormat', false, null);
                    break;
            }
            
            // Update button states
            this.updateToolbarStates();
        } catch (err) {
            console.warn('Command execution failed:', command, err);
        }
    }
    
    // ==== ENHANCED FEATURES ====
    
    
    
    // Simple language detection helper
    detectLanguage(text) {
        // Check for common language patterns (order matters - more specific first)
        const patterns = {
            json: /^\s*[\{\[].*[\}\]]\s*$/s,
            xml: /<[^>]+>/, // highlight.js uses 'xml' for HTML
            css: /\{[^}]*\}|@(media|import|keyframes)/,
            sql: /\b(SELECT|INSERT|UPDATE|DELETE|FROM|WHERE|JOIN)\b/i,
            python: /\b(def|class|import|from|elif|except|with|as|__init__|self\.)\b|^\s*(class|def)\s+\w+/m,
            javascript: /\b(function|const|let|var|class|import|export|=>|\{|\})\b|console\./,
            bash: /^(\$|#)|(\||&&|grep|ls|cd|mkdir)\b/
        };
        
        // Test in order of specificity
        for (const [language, pattern] of Object.entries(patterns)) {
            if (pattern.test(text)) {
                return language;
            }
        }
        
        return 'plaintext';
    }
    
    // Extract formatted text preserving whitespace, tabs, and line breaks
    extractFormattedText(range) {
        // Clone the range contents to preserve original formatting
        const clonedContents = range.cloneContents();
        
        // Create a temporary container to extract text while preserving whitespace
        const tempContainer = document.createElement('div');
        tempContainer.appendChild(clonedContents);
        
        // Extract text content with preserved whitespace
        return this.getTextWithWhitespace(tempContainer);
    }
    
    // Recursively extract text while preserving whitespace structure
    getTextWithWhitespace(node) {
        let text = '';
        
        for (const child of node.childNodes) {
            if (child.nodeType === Node.TEXT_NODE) {
                text += child.textContent;
            } else if (child.nodeType === Node.ELEMENT_NODE) {
                const tagName = child.tagName.toLowerCase();
                
                // Handle block elements that create line breaks
                if (['div', 'p', 'br'].includes(tagName)) {
                    // Add newline for block elements and br tags
                    if (tagName === 'br') {
                        text += '\n';
                    } else {
                        // For div/p, add content then newline
                        text += this.getTextWithWhitespace(child);
                        if (text && !text.endsWith('\n')) {
                            text += '\n';
                        }
                    }
                } else {
                    // For inline elements, just get the content
                    text += this.getTextWithWhitespace(child);
                }
            }
        }
        
        return text;
    }

    // Enhanced code block insertion with proper whitespace preservation
    insertCodeBlock() {
        const selection = window.getSelection();
        if (selection.rangeCount === 0) return;
        
        const range = selection.getRangeAt(0);
        
        // Use improved text extraction instead of range.toString()
        const selectedText = this.extractFormattedText(range);
        
        if (selectedText.trim()) {
            const isMultiline = selectedText.includes('\n');
            
            if (isMultiline) {
                // Multi-line: create pre > code
                const pre = document.createElement('pre');
                const code = document.createElement('code');
                
                // Auto-detect language or default to javascript
                const detectedLanguage = this.detectLanguage(selectedText);
                code.className = `language-${detectedLanguage}`;
                
                // Set the preserved text content
                code.textContent = selectedText;
                pre.appendChild(code);
                
                range.deleteContents();
                range.insertNode(pre);
                
                // Apply syntax highlighting
                if (window.hljs) {
                    hljs.highlightElement(code);
                }
                
                // Position cursor after the code block
                const newRange = document.createRange();
                newRange.setStartAfter(pre);
                newRange.collapse(true);
                selection.removeAllRanges();
                selection.addRange(newRange);
                
            } else {
                // Single line: create inline code
                const code = document.createElement('code');
                code.className = 'inline-code';
                code.textContent = selectedText.trim();
                
                range.deleteContents();
                range.insertNode(code);
                
                // Position cursor after the code
                const newRange = document.createRange();
                newRange.setStartAfter(code);
                newRange.collapse(true);
                selection.removeAllRanges();
                selection.addRange(newRange);
            }
        } else {
            // No selection - create empty inline code element
            const code = document.createElement('code');
            code.className = 'inline-code';
            code.textContent = '';
            
            range.insertNode(code);
            
            // Position cursor inside
            const newRange = document.createRange();
            newRange.selectNodeContents(code);
            selection.removeAllRanges();
            selection.addRange(newRange);
        }
    }
    
    // Alternative: Convert pasted content to code block
    convertToCodeBlock() {
        const selection = window.getSelection();
        if (selection.rangeCount === 0) return;
        
        // Find the current paragraph/div
        let element = selection.anchorNode;
        if (element.nodeType === Node.TEXT_NODE) {
            element = element.parentElement;
        }
        
        // Get to a block element
        while (element && !['DIV', 'P'].includes(element.tagName)) {
            element = element.parentElement;
        }
        
        if (element) {
            // Use improved text extraction for the entire element
            const text = this.getTextWithWhitespace(element);
            const isMultiline = text.includes('\n');
            
            if (isMultiline) {
                const pre = document.createElement('pre');
                const code = document.createElement('code');
                
                // Auto-detect language
                const detectedLanguage = this.detectLanguage(text);
                code.className = `language-${detectedLanguage}`;
                code.textContent = text;
                pre.appendChild(code);
                
                element.parentNode.replaceChild(pre, element);
                
                if (window.hljs) {
                    hljs.highlightElement(code);
                }
            }
        }
    }
    
    
    // Highlight text with background color
    highlightText(color) {
        const selection = window.getSelection();
        if (selection.rangeCount === 0) return;
        
        const range = selection.getRangeAt(0);
        if (range.collapsed) return;
        
        const span = document.createElement('span');
        span.style.backgroundColor = color;
        span.style.padding = '1px 2px';
        span.style.borderRadius = '2px';
        
        try {
            range.surroundContents(span);
        } catch (e) {
            // If surroundContents fails, extract and wrap contents
            const contents = range.extractContents();
            span.appendChild(contents);
            range.insertNode(span);
        }
        
        // Clear selection
        selection.removeAllRanges();
        
        // Position cursor after the highlighted text
        const newRange = document.createRange();
        newRange.setStartAfter(span);
        newRange.collapse(true);
        selection.addRange(newRange);
    }
    
    // Remove highlight from selected text
    removeHighlight() {
        const selection = window.getSelection();
        if (selection.rangeCount === 0) return;
        
        const range = selection.getRangeAt(0);
        const parentElement = range.commonAncestorContainer.nodeType === Node.TEXT_NODE
            ? range.commonAncestorContainer.parentNode
            : range.commonAncestorContainer;
        
        // Find all highlighted spans in the selection
        const spans = parentElement.querySelectorAll('span[style*="background-color"]');
        spans.forEach(span => {
            if (selection.containsNode(span, true)) {
                const parent = span.parentNode;
                while (span.firstChild) {
                    parent.insertBefore(span.firstChild, span);
                }
                parent.removeChild(span);
            }
        });
    }
    
    // Create interactive checkbox list
    insertCheckboxList() {
        const selection = window.getSelection();
        if (selection.rangeCount === 0) return;
        
        const range = selection.getRangeAt(0);
        
        const checkboxItem = document.createElement('div');
        checkboxItem.className = 'checkbox-item';
        
        // Create checkbox input
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'checkbox-input';
        
        // Create editable text span
        const text = document.createElement('span');
        text.className = 'checkbox-text';
        text.contentEditable = 'true';
        text.textContent = 'New task';
        
        // Add event listener to the checkbox
        checkbox.addEventListener('change', () => {
            if (checkbox.checked) {
                text.style.textDecoration = 'line-through';
                text.style.opacity = '0.6';
            } else {
                text.style.textDecoration = 'none';
                text.style.opacity = '1';
            }
        });
        
        // Handle Enter key in checkbox text
        text.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                // Create new checkbox item
                this.insertCheckboxList();
            }
        });
        
        checkboxItem.appendChild(checkbox);
        checkboxItem.appendChild(text);
        
        // Insert at current position
        range.insertNode(checkboxItem);
        
        // Add line break after
        const br = document.createElement('br');
        range.setStartAfter(checkboxItem);
        range.insertNode(br);
        
        // Position cursor at the end of the new text
        const newRange = document.createRange();
        newRange.selectNodeContents(text);
        newRange.collapse(false);
        selection.removeAllRanges();
        selection.addRange(newRange);
    }
    
    // Create link
    createLink() {
        const selection = window.getSelection();
        let selectedText = '';
        
        if (selection.rangeCount > 0) {
            selectedText = selection.toString();
        }
        
        const url = prompt('Enter URL:', 'https://');
        if (!url || url === 'https://') return;
        
        if (selectedText) {
            // Wrap selected text
            document.execCommand('createLink', false, url);
            // Set target and rel attributes
            const links = this.editor.querySelectorAll('a[href="' + url + '"]');
            links.forEach(link => {
                link.target = '_blank';
                link.rel = 'noopener noreferrer';
            });
        } else {
            // Insert new link
            const linkText = prompt('Enter link text:', url);
            if (!linkText) return;
            
            const link = document.createElement('a');
            link.href = url;
            link.textContent = linkText;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            
            if (selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                range.insertNode(link);
                
                // Position cursor after link
                const newRange = document.createRange();
                newRange.setStartAfter(link);
                newRange.collapse(true);
                selection.removeAllRanges();
                selection.addRange(newRange);
            }
        }
    }
    
    // ==== FONT SIZE ADJUSTMENT ====
    
    adjustFontSize(multiplier) {
        const selection = window.getSelection();
        if (selection.rangeCount === 0) return;
        
        const range = selection.getRangeAt(0);
        
        if (range.collapsed) {
            // No selection - apply to current word or create new span
            this.adjustFontSizeAtCursor(multiplier);
        } else {
            // Text is selected
            this.adjustFontSizeForSelection(range, multiplier);
        }
    }
    
    adjustFontSizeAtCursor(multiplier) {
        const selection = window.getSelection();
        const range = selection.getRangeAt(0);
        
        // Find current element and get its computed font size
        let element = range.startContainer;
        if (element.nodeType === Node.TEXT_NODE) {
            element = element.parentElement;
        }
        
        const currentFontSize = window.getComputedStyle(element).fontSize;
        const currentSizeNum = parseFloat(currentFontSize);
        const newSize = Math.max(8, Math.min(72, currentSizeNum * multiplier));
        
        // Create a span with the new font size
        const span = document.createElement('span');
        span.style.fontSize = newSize + 'px';
        span.innerHTML = '&nbsp;'; // Non-breaking space as placeholder
        
        range.insertNode(span);
        
        // Position cursor inside the span
        const newRange = document.createRange();
        newRange.selectNodeContents(span);
        newRange.collapse(false);
        selection.removeAllRanges();
        selection.addRange(newRange);
    }
    
    adjustFontSizeForSelection(range, multiplier) {
        const selection = window.getSelection();
        
        // Store the selection boundaries
        const startContainer = range.startContainer;
        const startOffset = range.startOffset;
        const endContainer = range.endContainer;
        const endOffset = range.endOffset;
        
        // Get the selected text content
        const selectedText = range.toString();
        if (!selectedText.trim()) return;
        
        // Extract the contents
        const contents = range.extractContents();
        
        // Create wrapper span with adjusted font size
        const wrapper = document.createElement('span');
        
        // Determine base font size from the selection context
        let baseFontSize = 16;
        const parentElement = startContainer.nodeType === Node.TEXT_NODE 
            ? startContainer.parentElement 
            : startContainer;
            
        if (parentElement) {
            const computedStyle = window.getComputedStyle(parentElement);
            baseFontSize = parseFloat(computedStyle.fontSize) || 16;
        }
        
        // Apply font size adjustment
        const newSize = Math.max(8, Math.min(72, baseFontSize * multiplier));
        wrapper.style.fontSize = newSize + 'px';
        
        // Process the contents to preserve existing formatting
        this.processContentsForFontSize(contents, multiplier, baseFontSize);
        
        // Add the processed contents to the wrapper
        wrapper.appendChild(contents);
        
        // Insert the wrapper at the selection
        range.insertNode(wrapper);
        
        // Restore selection to highlight the adjusted text
        const newRange = document.createRange();
        newRange.selectNodeContents(wrapper);
        selection.removeAllRanges();
        selection.addRange(newRange);
    }
    
    processContentsForFontSize(contents, multiplier, baseFontSize) {
        const walker = document.createTreeWalker(
            contents,
            NodeFilter.SHOW_ALL,
            null,
            false
        );
        
        const elementsToProcess = [];
        let node;
        
        // Collect all elements that might have font-size styling
        while (node = walker.nextNode()) {
            if (node.nodeType === Node.ELEMENT_NODE) {
                const style = node.style;
                if (style && style.fontSize) {
                    elementsToProcess.push({
                        element: node,
                        currentSize: parseFloat(style.fontSize)
                    });
                } else if (node.tagName === 'SPAN') {
                    elementsToProcess.push({
                        element: node,
                        currentSize: baseFontSize
                    });
                }
            }
        }
        
        // Adjust font sizes for elements that already have sizing
        elementsToProcess.forEach(item => {
            const newSize = Math.max(8, Math.min(72, item.currentSize * multiplier));
            item.element.style.fontSize = newSize + 'px';
        });
    }
    
    
    // ==== UTILITY METHODS ====
    
    
    updateToolbarStates() {
        const buttons = this.toolbar.querySelectorAll('.toolbar-button');
        
        buttons.forEach(button => {
            const command = button.dataset.command;
            button.classList.remove('active');
            
            try {
                if (document.queryCommandState(command)) {
                    button.classList.add('active');
                }
            } catch (err) {
                // Some commands don't support queryCommandState
                // Handle special cases
                if (command === 'formatH1' || command === 'formatH2' || command === 'formatH3') {
                    const selection = window.getSelection();
                    if (selection.rangeCount > 0) {
                        const element = selection.anchorNode.nodeType === Node.TEXT_NODE 
                            ? selection.anchorNode.parentElement 
                            : selection.anchorNode;
                        
                        if (element && element.tagName && element.tagName.toLowerCase() === command.replace('format', '').toLowerCase()) {
                            button.classList.add('active');
                        }
                    }
                }
            }
        });
    }
    
    // ==== CUSTOM SCROLLBAR ====
    initializeCustomScrollbar() {
        this.customScrollbar = new CustomScrollbar();
        this.customScrollbar.initialize();
    }
}

// ==== CUSTOM SCROLLBAR CLASS ====
class CustomScrollbar {
    constructor() {
        this.richTextEditor = null;
        this.editorContainer = null;
        this.customScrollbar = null;
        this.scrollThumb = null;
        this.isDragging = false;
        this.startY = 0;
        this.startScrollTop = 0;
    }
    
    initialize() {
        this.richTextEditor = document.getElementById('note-content');
        this.editorContainer = document.querySelector('.rich-text-editor-container');
        this.customScrollbar = document.querySelector('.custom-scrollbar');
        this.scrollThumb = document.querySelector('.scrollbar-thumb');
        
        if (!this.richTextEditor || !this.editorContainer) return;
        
        this.setupEventListeners();
        this.updateScrollbar();
    }
    
    setupEventListeners() {
        if (!this.richTextEditor || !this.scrollThumb || !this.editorContainer) return;
        
        // Mouse events for dragging
        this.scrollThumb.addEventListener('mousedown', (e) => this.startDrag(e));
        document.addEventListener('mousemove', (e) => this.drag(e));
        document.addEventListener('mouseup', () => this.stopDrag());
        
        // Wheel scrolling on rich text editor
        this.richTextEditor.addEventListener('wheel', (e) => this.handleWheel(e));
        
        // Update scrollbar on scroll
        this.richTextEditor.addEventListener('scroll', () => this.updateThumbPosition());
        
        // Show/hide scrollbar on hover over editor container
        this.editorContainer.addEventListener('mouseenter', () => this.showScrollbar());
        this.editorContainer.addEventListener('mouseleave', () => this.hideScrollbar());
        
        // Update scrollbar when content changes
        const observer = new MutationObserver(() => {
            setTimeout(() => this.updateScrollbar(), 0);
        });
        observer.observe(this.richTextEditor, { 
            childList: true, 
            subtree: true, 
            characterData: true,
            attributes: true 
        });
        
        // Update on input events in the rich text editor
        this.richTextEditor.addEventListener('input', () => {
            setTimeout(() => this.updateScrollbar(), 0);
        });
    }
    
    startDrag(e) {
        e.preventDefault();
        this.isDragging = true;
        this.startY = e.clientY;
        this.startScrollTop = this.richTextEditor.scrollTop;
        document.body.style.userSelect = 'none';
    }
    
    drag(e) {
        if (!this.isDragging) return;
        
        const deltaY = e.clientY - this.startY;
        const editorHeight = this.richTextEditor.offsetHeight;
        const contentHeight = this.richTextEditor.scrollHeight;
        const scrollableHeight = contentHeight - editorHeight;
        const thumbHeight = this.scrollThumb.offsetHeight;
        
        // Account for scrollbar margins (8px top, 8px bottom)
        const scrollbarHeight = editorHeight - 16;
        const trackHeight = scrollbarHeight - thumbHeight;
        
        if (scrollableHeight <= 0 || trackHeight <= 0) return;
        
        const scrollRatio = deltaY / trackHeight;
        const newScrollTop = this.startScrollTop + (scrollRatio * scrollableHeight);
        
        this.richTextEditor.scrollTop = Math.max(0, Math.min(scrollableHeight, newScrollTop));
    }
    
    stopDrag() {
        this.isDragging = false;
        document.body.style.userSelect = '';
    }
    
    handleWheel(e) {
        // Don't prevent default - let the browser handle the scrolling
        // Just update the scrollbar position after scroll
        setTimeout(() => this.updateThumbPosition(), 0);
    }
    
    updateScrollbar() {
        if (!this.richTextEditor || !this.editorContainer || !this.scrollThumb || !this.customScrollbar) return;
        
        const editorHeight = this.richTextEditor.offsetHeight;
        const contentHeight = this.richTextEditor.scrollHeight;
        
        // Check if scrolling is needed
        if (contentHeight <= editorHeight) {
            this.customScrollbar.classList.remove('visible');
            return;
        }
        
        // Content overflows, make scrollbar available (will show on hover)
        // Don't auto-show, let hover behavior handle visibility
        
        // Account for scrollbar margins (8px top, 8px bottom)
        const scrollbarHeight = editorHeight - 16;
        const thumbHeight = Math.max(30, (editorHeight / contentHeight) * scrollbarHeight);
        this.scrollThumb.style.height = `${thumbHeight}px`;
        
        this.updateThumbPosition();
    }
    
    updateThumbPosition() {
        const editorHeight = this.richTextEditor.offsetHeight;
        const contentHeight = this.richTextEditor.scrollHeight;
        const scrollTop = this.richTextEditor.scrollTop;
        const thumbHeight = this.scrollThumb.offsetHeight;
        const scrollableHeight = contentHeight - editorHeight;
        
        if (scrollableHeight <= 0) return;
        
        // Account for scrollbar margins (8px top, 8px bottom)
        const scrollbarHeight = editorHeight - 16;
        const trackHeight = scrollbarHeight - thumbHeight;
        
        const scrollRatio = scrollTop / scrollableHeight;
        const thumbTop = scrollRatio * trackHeight;
        
        this.scrollThumb.style.top = `${Math.max(0, Math.min(trackHeight, thumbTop))}px`;
    }
    
    showScrollbar() {
        if (this.richTextEditor && this.richTextEditor.scrollHeight > this.richTextEditor.offsetHeight) {
            this.customScrollbar.classList.add('visible');
        }
    }
    
    hideScrollbar() {
        if (!this.isDragging) {
            this.customScrollbar.classList.remove('visible');
        }
    }
    
    reset() {
        if (this.richTextEditor) {
            this.richTextEditor.scrollTop = 0;
        }
        this.updateScrollbar();
    }
}

