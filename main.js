// ==============================================================================
// KeepNote - Simple Note App
// Based on VimCheat architecture with minimal modifications
// ==============================================================================

// ==== CONFIGURATION ====
const CONFIG = {
    storageKey: 'keepnote-data',
    searchThreshold: 0.3,
    minSearchLength: 2,
    debounceDelay: 150,
    autoSaveWordThreshold: 10
};

// ==== DATA LAYER ====
class NoteManager {
    constructor() {
        this.notes = [];
        this.currentNote = null;
    }
    
    loadNotes() {
        try {
            const data = localStorage.getItem(CONFIG.storageKey);
            this.notes = data ? JSON.parse(data) : [];
            
            // Ensure all notes have required properties
            this.notes.forEach((note, index) => {
                if (!note.backgroundColor) {
                    note.backgroundColor = 'white';
                }
                if (!note.contentType) {
                    note.contentType = 'html';
                }
                if (!note.displayOrder) {
                    // Assign display order based on current position, with older notes having lower order
                    note.displayOrder = note.modifiedAt || (Date.now() - index * 1000);
                }
            });
            
            // Save updated notes if we added missing properties
            if (this.notes.length > 0) {
                this.saveNotes();
            }
            
            return true;
        } catch (error) {
            console.error('Failed to load notes:', error);
            this.notes = [];
            return false;
        }
    }
    
    saveNotes() {
        try {
            localStorage.setItem(CONFIG.storageKey, JSON.stringify(this.notes));
            return true;
        } catch (error) {
            console.error('Failed to save notes:', error);
            return false;
        }
    }
    
    createNote(title, content, contentType = 'html', backgroundColor = 'white') {
        const note = {
            id: this.generateId(),
            title: title || '',
            content: content || '',
            contentType: contentType,
            backgroundColor: backgroundColor,
            displayOrder: Date.now(), // Add custom order field
            createdAt: Date.now(),
            modifiedAt: Date.now()
        };
        
        this.notes.unshift(note);
        this.saveNotes();
        return note;
    }
    
    updateNote(id, updates) {
        const noteIndex = this.notes.findIndex(note => note.id === id);
        if (noteIndex === -1) return false;
        
        this.notes[noteIndex] = {
            ...this.notes[noteIndex],
            ...updates,
            modifiedAt: Date.now()
        };
        
        // Ensure contentType is set for existing notes
        if (!this.notes[noteIndex].contentType) {
            this.notes[noteIndex].contentType = 'html';
        }
        
        // Ensure backgroundColor is set for existing notes
        if (!this.notes[noteIndex].backgroundColor) {
            this.notes[noteIndex].backgroundColor = 'white';
        }
        
        this.saveNotes();
        return this.notes[noteIndex];
    }
    
    deleteNote(id) {
        const noteIndex = this.notes.findIndex(note => note.id === id);
        if (noteIndex === -1) return false;
        
        this.notes.splice(noteIndex, 1);
        this.saveNotes();
        return true;
    }
    
    getNoteById(id) {
        return this.notes.find(note => note.id === id);
    }
    
    getAllNotes() {
        // Sort by custom order if available, otherwise by modifiedAt
        return this.notes.sort((a, b) => {
            if (a.displayOrder && b.displayOrder) {
                return b.displayOrder - a.displayOrder;
            }
            return b.modifiedAt - a.modifiedAt;
        });
    }
    
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }
}

// ==== SEARCH ENGINE ====
class SearchEngine {
    constructor(noteManager) {
        this.noteManager = noteManager;
    }
    
    search(query) {
        if (!query || query.length < CONFIG.minSearchLength) {
            return [];
        }
        
        const normalizedQuery = query.toLowerCase().trim();
        const results = new Map();
        const scores = new Map();
        
        // Search in titles (highest priority)
        this.noteManager.notes.forEach(note => {
            if (note.title && note.title.toLowerCase().includes(normalizedQuery)) {
                const score = this.calculateScore(note.title, normalizedQuery, 3);
                if (!scores.has(note.id) || scores.get(note.id) < score) {
                    scores.set(note.id, score);
                    results.set(note.id, note);
                }
            }
        });
        
        // Search in content (strip HTML for search)
        this.noteManager.notes.forEach(note => {
            if (note.content) {
                // Strip HTML tags for searching
                const plainContent = note.contentType === 'html' 
                    ? this.stripHtml(note.content) 
                    : note.content;
                if (plainContent && plainContent.toLowerCase().includes(normalizedQuery)) {
                    const score = this.calculateScore(plainContent, normalizedQuery, 2);
                    if (!scores.has(note.id) || scores.get(note.id) < score) {
                        scores.set(note.id, score);
                        results.set(note.id, note);
                    }
                }
            }
        });
        
        // Sort by score
        const sortedResults = Array.from(results.values()).sort((a, b) => {
            return scores.get(b.id) - scores.get(a.id);
        });
        
        return sortedResults;
    }
    
    calculateScore(text, query, weight) {
        const textLower = text.toLowerCase();
        const queryLower = query.toLowerCase();
        
        // Exact match gets highest score
        if (textLower === queryLower) return weight * 10;
        
        // Starting with query gets high score
        if (textLower.startsWith(queryLower)) return weight * 5;
        
        // Contains query gets base score
        if (textLower.includes(queryLower)) return weight * 2;
        
        return weight;
    }
    
    stripHtml(html) {
        const div = document.createElement('div');
        div.innerHTML = html;
        return div.textContent || div.innerText || '';
    }
}

// ==== MASONRY LAYOUT ====
class MasonryLayout {
    constructor(gap = 24) {
        this.gap = gap;
        this.columns = [];
        this.resizeObserver = null;
        this.lastWidth = 0;
        this.debounceTimer = null;
    }
    
    calculateColumns(containerWidth, cardWidth = 280) {
        const minCardWidth = Math.min(cardWidth, containerWidth);
        const availableWidth = containerWidth - this.gap;
        const columnsCount = Math.max(1, Math.floor((availableWidth + this.gap) / (minCardWidth + this.gap)));
        const actualCardWidth = Math.floor((availableWidth - (columnsCount - 1) * this.gap) / columnsCount);
        
        return {
            count: columnsCount,
            width: actualCardWidth
        };
    }
    
    layout(container, cards) {
        if (!container || !cards.length) return;
        
        const containerWidth = container.offsetWidth;
        const { count: columnsCount, width: cardWidth } = this.calculateColumns(containerWidth);
        
        // Initialize column heights
        this.columns = new Array(columnsCount).fill(0);
        
        cards.forEach((card, index) => {
            // Set card width
            card.style.width = `${cardWidth}px`;
            
            // Find the shortest column
            const shortestColumnIndex = this.columns.indexOf(Math.min(...this.columns));
            const x = shortestColumnIndex * (cardWidth + this.gap);
            const y = this.columns[shortestColumnIndex];
            
            // Position the card
            card.style.left = `${x}px`;
            card.style.top = `${y}px`;
            
            // Add positioned class for animation
            card.classList.add('positioned');
            
            // Update column height (add card height + gap for next card)
            const cardHeight = card.offsetHeight || card.getBoundingClientRect().height;
            this.columns[shortestColumnIndex] += cardHeight + this.gap;
        });
        
        // Set container height to the tallest column
        const maxHeight = Math.max(...this.columns) - this.gap;
        container.style.height = `${maxHeight}px`;
    }
    
    relayout(container, cards) {
        // Reset positioning classes for re-animation
        cards.forEach(card => {
            card.classList.remove('positioned');
            card.style.left = '';
            card.style.top = '';
            card.style.width = '';
        });
        
        // Small delay to ensure styles are reset, then layout
        setTimeout(() => {
            this.layout(container, cards);
        }, 10);
    }
    
    smoothLayout(container, cards) {
        if (!container || !cards.length) return;
        
        const containerWidth = container.offsetWidth;
        const { count: columnsCount, width: cardWidth } = this.calculateColumns(containerWidth);
        
        // Initialize column heights
        this.columns = new Array(columnsCount).fill(0);
        
        // Calculate new positions without removing 'positioned' class
        const newPositions = [];
        
        cards.forEach((card, index) => {
            // Set card width
            card.style.width = `${cardWidth}px`;
            
            // Find the shortest column
            const shortestColumnIndex = this.columns.indexOf(Math.min(...this.columns));
            const x = shortestColumnIndex * (cardWidth + this.gap);
            const y = this.columns[shortestColumnIndex];
            
            // Store new position
            newPositions.push({ card, x, y });
            
            // Update column height
            const cardHeight = card.offsetHeight || card.getBoundingClientRect().height;
            this.columns[shortestColumnIndex] += cardHeight + this.gap;
        });
        
        // Apply positions with smooth transition
        newPositions.forEach(({ card, x, y }, index) => {
            // Small staggered delay for smoother animation
            setTimeout(() => {
                card.style.left = `${x}px`;
                card.style.top = `${y}px`;
                card.classList.add('positioned');
            }, index * 20);
        });
        
        // Set container height
        const maxHeight = Math.max(...this.columns) - this.gap;
        container.style.height = `${maxHeight}px`;
    }
    
    setupAutoResize(container, getCards) {
        // Clean up existing observer
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        }
        
        // Create new observer
        this.resizeObserver = new ResizeObserver(entries => {
            for (let entry of entries) {
                const newWidth = entry.contentRect.width;
                
                // Only relayout if width change is significant (> 20px)
                if (Math.abs(newWidth - this.lastWidth) > 20) {
                    this.lastWidth = newWidth;
                    
                    // Debounce the relayout
                    clearTimeout(this.debounceTimer);
                    this.debounceTimer = setTimeout(() => {
                        const cards = getCards();
                        if (cards.length > 0) {
                            this.relayout(container, cards);
                        }
                    }, 100);
                }
            }
        });
        
        this.resizeObserver.observe(container);
    }
    
    destroy() {
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
            this.resizeObserver = null;
        }
        clearTimeout(this.debounceTimer);
    }
}

// ==== DRAG AND DROP CLASSES ====
class DragHandler {
    constructor(uiManager) {
        this.uiManager = uiManager;
        this.draggedCard = null;
        this.draggedNoteId = null;
        this.ghostElement = null;
        this.isDragging = false;
        this.boundMouseMove = null;
        this.boundMouseUp = null;
    }
    
    startDrag(card, noteId, event) {
        this.draggedCard = card;
        this.draggedNoteId = noteId;
        this.isDragging = true;
        
        // Add dragging class for visual feedback
        card.classList.add('dragging');
        
        // Create ghost element for dragging
        this.createGhostElement(card, event);
        
        // Show drop zones
        this.uiManager.dropZoneManager.showDropZones();
        
        // Prevent text selection
        document.body.style.userSelect = 'none';
        
        // Store bound functions for proper cleanup
        this.boundMouseMove = this.handleMouseMove.bind(this);
        this.boundMouseUp = this.endDrag.bind(this);
        
        // Add global mouse move and up listeners
        document.addEventListener('mousemove', this.boundMouseMove);
        document.addEventListener('mouseup', this.boundMouseUp);
        
        console.log('Drag started for note:', noteId);
    }
    
    createGhostElement(card, event) {
        this.ghostElement = card.cloneNode(true);
        this.ghostElement.classList.add('ghost');
        this.ghostElement.style.position = 'fixed';
        this.ghostElement.style.pointerEvents = 'none';
        this.ghostElement.style.width = card.offsetWidth + 'px';
        this.ghostElement.style.zIndex = '1001';
        
        document.body.appendChild(this.ghostElement);
        
        this.updateGhostPosition(event);
    }
    
    updateGhostPosition(event) {
        if (this.ghostElement) {
            this.ghostElement.style.left = (event.clientX - this.ghostElement.offsetWidth / 2) + 'px';
            this.ghostElement.style.top = (event.clientY - this.ghostElement.offsetHeight / 2) + 'px';
        }
    }
    
    handleMouseMove(event) {
        if (!this.isDragging) return;
        
        this.updateGhostPosition(event);
        
        // Update drop zone highlighting
        this.uiManager.dropZoneManager.updateDropZone(event);
    }
    
    endDrag(event) {
        if (!this.isDragging) return;
        
        console.log('Ending drag...');
        this.isDragging = false;
        
        // Remove dragging class
        if (this.draggedCard) {
            this.draggedCard.classList.remove('dragging');
        }
        
        // Remove ghost element safely
        try {
            if (this.ghostElement && this.ghostElement.parentNode) {
                this.ghostElement.parentNode.removeChild(this.ghostElement);
            }
        } catch (error) {
            console.warn('Failed to remove ghost element:', error);
        }
        this.ghostElement = null;
        
        // Handle drop with fallback
        try {
            const dropIndex = this.uiManager.dropZoneManager.getDropIndex(event);
            console.log('Drop index:', dropIndex);
            
            if (dropIndex !== -1 && this.draggedNoteId) {
                console.log('Reordering note:', this.draggedNoteId, 'to index:', dropIndex);
                this.uiManager.orderManager.reorderNote(this.draggedNoteId, dropIndex);
            } else {
                console.log('No valid drop zone found or missing note ID');
            }
        } catch (error) {
            console.error('Failed to reorder note:', error);
            // Fallback: just refresh the view
            this.uiManager.renderNotes();
        }
        
        // Always hide drop zones
        this.uiManager.dropZoneManager.hideDropZones();
        
        // Cleanup with proper bound function references
        this.cleanup();
    }
    
    cleanup() {
        document.body.style.userSelect = '';
        
        if (this.boundMouseMove) {
            document.removeEventListener('mousemove', this.boundMouseMove);
            this.boundMouseMove = null;
        }
        if (this.boundMouseUp) {
            document.removeEventListener('mouseup', this.boundMouseUp);
            this.boundMouseUp = null;
        }
        
        // Reset state
        this.draggedCard = null;
        this.draggedNoteId = null;
        
        // Ensure no ghost elements remain
        document.querySelectorAll('.note-card.ghost').forEach(ghost => {
            try {
                ghost.parentNode?.removeChild(ghost);
            } catch (error) {
                console.warn('Failed to cleanup ghost element:', error);
            }
        });
    }
}

class DropZoneManager {
    constructor(masonryLayout) {
        this.masonryLayout = masonryLayout;
        this.targetCard = null;
        this.insertPosition = 'after'; // 'before' or 'after'
    }
    
    showDropZones() {
        // Add visual indicator to all non-dragging cards
        const cards = document.querySelectorAll('.note-card:not(.dragging)');
        cards.forEach(card => {
            card.classList.add('drop-target');
        });
        console.log('Drop targets enabled for', cards.length, 'cards');
    }
    
    updateDropZone(event) {
        // Find the card we're hovering over
        const elementBelow = document.elementFromPoint(event.clientX, event.clientY);
        const targetCard = elementBelow?.closest('.note-card:not(.dragging)');
        
        // Clear previous highlights
        document.querySelectorAll('.note-card.drop-before, .note-card.drop-after').forEach(card => {
            card.classList.remove('drop-before', 'drop-after');
        });
        
        if (targetCard) {
            // Determine if we should insert before or after this card
            const cardRect = targetCard.getBoundingClientRect();
            const mouseY = event.clientY;
            const cardMiddle = cardRect.top + cardRect.height / 2;
            
            this.targetCard = targetCard;
            this.insertPosition = mouseY < cardMiddle ? 'before' : 'after';
            
            // Add visual feedback
            targetCard.classList.add(`drop-${this.insertPosition}`);
            
            console.log('Hovering over card, insert:', this.insertPosition);
        } else {
            this.targetCard = null;
            this.insertPosition = 'after';
        }
    }
    
    getDropIndex(event) {
        if (!this.targetCard) {
            // No target card, append to end
            const allCards = document.querySelectorAll('.note-card:not(.dragging)');
            return allCards.length;
        }
        
        // Find the index of the target card
        const allCards = Array.from(document.querySelectorAll('.note-card:not(.dragging)'));
        const targetIndex = allCards.indexOf(this.targetCard);
        
        if (targetIndex === -1) return -1;
        
        // Return the insertion index
        return this.insertPosition === 'before' ? targetIndex : targetIndex + 1;
    }
    
    hideDropZones() {
        // Remove all drop indicators
        document.querySelectorAll('.note-card.drop-target, .note-card.drop-before, .note-card.drop-after').forEach(card => {
            card.classList.remove('drop-target', 'drop-before', 'drop-after');
        });
        
        this.targetCard = null;
        this.insertPosition = 'after';
        console.log('Drop zones hidden');
    }
}

class OrderManager {
    constructor(noteManager, uiManager) {
        this.noteManager = noteManager;
        this.uiManager = uiManager;
    }
    
    reorderNote(noteId, newIndex) {
        const notes = this.noteManager.getAllNotes();
        const currentIndex = notes.findIndex(note => note.id === noteId);
        
        console.log('Reordering note:', noteId, 'from', currentIndex, 'to', newIndex);
        
        if (currentIndex === -1) {
            console.log('Note not found!');
            return;
        }
        
        if (currentIndex === newIndex) {
            console.log('Same position, no reordering needed');
            return;
        }
        
        // Simple approach: reassign all displayOrders based on new order
        // Create a new array with the moved note
        const reorderedNotes = [...notes];
        const [movedNote] = reorderedNotes.splice(currentIndex, 1);
        reorderedNotes.splice(newIndex, 0, movedNote);
        
        // Reassign displayOrder values with large gaps to avoid precision issues
        const baseTime = Date.now();
        reorderedNotes.forEach((note, index) => {
            const newDisplayOrder = baseTime - (index * 10000); // Large gaps
            this.noteManager.updateNote(note.id, { displayOrder: newDisplayOrder });
            console.log(`Note ${note.id} assigned displayOrder: ${newDisplayOrder} (position ${index})`);
        });
        
        console.log('Reordering complete, updating layout smoothly...');
        this.uiManager.updateLayoutSmoothly();
    }
    
    updateOrder(orderedNoteIds) {
        const now = Date.now();
        orderedNoteIds.forEach((noteId, index) => {
            const displayOrder = now - index; // Higher displayOrder = earlier in list
            this.noteManager.updateNote(noteId, { displayOrder });
        });
    }
}

// ==== UI COMPONENTS ====
class UIManager {
    constructor(noteManager, searchEngine) {
        this.noteManager = noteManager;
        this.searchEngine = searchEngine;
        this.currentView = 'notes';
        this.isEditing = false;
        this.currentNoteId = null;
        this.masonryLayout = new MasonryLayout(24); // 24px gap (var(--space-lg))
        this.richTextEditor = null;
        
        // Initialize drag and drop managers
        this.dropZoneManager = new DropZoneManager(this.masonryLayout);
        this.orderManager = new OrderManager(this.noteManager, this);
        this.dragHandler = new DragHandler(this);
        
        // Modal positioning and resizing
        this.modalDragging = false;
        this.modalResizing = false;
        this.modalStartPos = { x: 0, y: 0 };
        this.modalStartSize = { width: 0, height: 0 };
        this.dragOffset = { x: 0, y: 0 };
        this.isTouchDevice = 'ontouchstart' in window;
        
        // Fullscreen toggle state
        this.modalIsMaximized = false;
        this.modalRestoreState = null;
    }
    
    init() {
        this.renderNotes();
        this.updateStats();
        this.attachEventListeners();
        this.checkEmptyState();
        this.initializeRichTextEditor();
        this.initializeModalFeatures();
    }
    
    initializeRichTextEditor() {
        const editorElement = document.getElementById('note-content');
        const toolbarElement = document.querySelector('.rich-text-toolbar');
        
        if (editorElement && toolbarElement) {
            this.richTextEditor = new RichTextEditor(editorElement, toolbarElement);
        }
    }
    
    renderNotes() {
        const grid = document.getElementById('notes-grid');
        grid.innerHTML = '';
        
        const notes = this.noteManager.getAllNotes();
        
        // Create all cards first
        const cards = [];
        notes.forEach(note => {
            const card = this.createNoteCard(note);
            grid.appendChild(card);
            cards.push(card);
        });
        
        // Apply masonry layout after DOM insertion
        if (cards.length > 0) {
            setTimeout(() => {
                this.masonryLayout.layout(grid, cards);
                this.setupMasonryResize();
            }, 0);
        }
        
        this.checkEmptyState();
    }
    
    updateLayoutSmoothly() {
        const grid = document.getElementById('notes-grid');
        const existingCards = Array.from(grid.querySelectorAll('.note-card'));
        const notes = this.noteManager.getAllNotes();
        
        // Create a map of existing cards by note ID
        const existingCardMap = new Map();
        existingCards.forEach(card => {
            const noteId = card.dataset.noteId;
            if (noteId) {
                existingCardMap.set(noteId, card);
            }
        });
        
        // Reorder DOM elements to match new order
        const reorderedCards = [];
        notes.forEach(note => {
            const existingCard = existingCardMap.get(note.id);
            if (existingCard) {
                // Remove from current position and add to end
                grid.appendChild(existingCard);
                reorderedCards.push(existingCard);
            }
        });
        
        // Apply smooth masonry layout transition
        if (reorderedCards.length > 0) {
            // Use smooth layout instead of regular layout
            setTimeout(() => {
                this.masonryLayout.smoothLayout(grid, reorderedCards);
            }, 100);
        }
        
        this.checkEmptyState();
    }
    
    createNoteCard(note) {
        const card = document.createElement('div');
        card.className = 'note-card';
        card.dataset.noteId = note.id;
        
        const title = note.title || '';
        const content = note.content || '';
        
        // Handle both HTML and plain text content
        let displayContent;
        if (note.contentType === 'html') {
            // Strip HTML for display but preserve some basic formatting
            displayContent = this.stripHtml(content);
        } else {
            displayContent = content;
        }
        
        // Calculate intelligent height class based on content length
        const heightClass = this.calculateCardHeight(title, displayContent);
        card.classList.add(heightClass);
        
        const truncatedContent = this.truncateText(displayContent, 150);
        const timeAgo = this.formatTimeAgo(note.modifiedAt);
        
        // Create title section only if title exists
        const titleHtml = title ? `<div class="note-title">${this.escapeHtml(title)}</div>` : '';
        
        card.innerHTML = `
            <div class="card-actions">
                <div class="card-color-picker">
                    <button class="color-picker-toggle" title="Change color">
                        <i class="ph ph-palette"></i>
                    </button>
                    <div class="color-options">
                        <button class="color-option" data-color="white" title="Default"></button>
                        <button class="color-option" data-color="yellow" title="Yellow"></button>
                        <button class="color-option" data-color="orange" title="Orange"></button>
                        <button class="color-option" data-color="pink" title="Pink"></button>
                        <button class="color-option" data-color="purple" title="Purple"></button>
                        <button class="color-option" data-color="blue" title="Blue"></button>
                        <button class="color-option" data-color="green" title="Green"></button>
                    </div>
                </div>
                <button class="card-delete-btn" title="Delete note">
                    <i class="ph ph-trash"></i>
                </button>
            </div>
            ${titleHtml}
            <div class="note-content">${this.escapeHtml(truncatedContent)}</div>
            <div class="note-meta">${timeAgo}</div>
        `;
        
        
        // Add click handler for delete button
        const deleteBtn = card.querySelector('.card-delete-btn');
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.deleteCardNote(note.id);
        });
        
        // Add click handlers for color picker
        const colorPickerToggle = card.querySelector('.color-picker-toggle');
        const colorOptions = card.querySelector('.color-options');
        
        colorPickerToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            colorOptions.classList.toggle('visible');
        });
        
        // Add click handlers for color options
        const colorButtons = card.querySelectorAll('.color-option');
        colorButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                const color = button.dataset.color;
                this.changeNoteColor(note.id, color);
                colorOptions.classList.remove('visible');
            });
        });
        
        // Apply background color
        this.updateCardBackgroundColor(card, note.backgroundColor || 'white');
        
        // Add drag event listeners for reordering
        this.addDragListeners(card, note.id);
        
        return card;
    }
    
    calculateCardHeight(title, content) {
        // Calculate based on combined content length
        const titleLength = title.length;
        const contentLength = content.length;
        const totalLength = titleLength + contentLength;
        
        // Consider line breaks in content for better height estimation
        const lineCount = content.split('\n').length;
        const estimatedLines = Math.max(lineCount, Math.ceil(contentLength / 80));
        
        // Determine height class based on content metrics
        if (totalLength < 100 || estimatedLines <= 3) {
            return 'height-short';
        } else if (totalLength < 400 || estimatedLines <= 8) {
            return 'height-medium';
        } else {
            return 'height-large';
        }
    }
    
    addDragListeners(card, noteId) {
        let dragStartY = 0;
        let dragStartX = 0;
        let isDragging = false;
        
        card.addEventListener('mousedown', (e) => {
            // Don't start drag on action buttons
            if (e.target.closest('.card-actions')) {
                return;
            }
            
            dragStartX = e.clientX;
            dragStartY = e.clientY;
            isDragging = false;
            
            const handleMouseMove = (e) => {
                const deltaX = Math.abs(e.clientX - dragStartX);
                const deltaY = Math.abs(e.clientY - dragStartY);
                
                // Start dragging if moved more than 5px
                if ((deltaX > 5 || deltaY > 5) && !isDragging) {
                    isDragging = true;
                    this.dragHandler.startDrag(card, noteId, e);
                }
            };
            
            const handleMouseUp = () => {
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
                
                if (!isDragging) {
                    // If not dragging, treat as click to edit
                    this.editNote(noteId);
                }
            };
            
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        });
    }
    
    editNote(noteId) {
        const note = this.noteManager.getNoteById(noteId);
        if (!note) return;
        
        this.currentNoteId = noteId;
        this.isEditing = true;
        
        document.getElementById('note-title').value = note.title || '';
        
        if (this.richTextEditor) {
            if (note.contentType === 'html') {
                this.richTextEditor.setContent(note.content || '');
            } else {
                // Convert plain text to HTML
                this.richTextEditor.setContent(this.escapeHtml(note.content || ''));
            }
        }
        
        document.getElementById('delete-note').style.display = 'block';
        
        this.showModal();
    }
    
    createNewNote() {
        this.currentNoteId = null;
        this.isEditing = false;
        
        document.getElementById('note-title').value = '';
        if (this.richTextEditor) {
            this.richTextEditor.setContent('');
        }
        document.getElementById('delete-note').style.display = 'none';
        
        this.showModal();
        
        // Focus title input
        setTimeout(() => {
            document.getElementById('note-title').focus();
        }, 100);
    }
    
    saveNote() {
        const title = document.getElementById('note-title').value.trim();
        const content = this.richTextEditor ? this.richTextEditor.getContent() : '';
        
        // Check if content is empty (only contains empty tags or whitespace)
        const plainContent = this.stripHtml(content);
        if (!title && !plainContent) {
            this.hideModal();
            return;
        }
        
        if (this.isEditing && this.currentNoteId) {
            // Update existing note
            this.noteManager.updateNote(this.currentNoteId, { title, content, contentType: 'html' });
        } else {
            // Create new note
            this.noteManager.createNote(title, content, 'html');
        }
        
        this.renderNotes();
        this.updateStats();
        this.hideModal();
        
        // If we were in search view, update search results
        if (this.currentView === 'search') {
            const query = document.getElementById('search-input').value;
            if (query) {
                this.performSearch(query);
            }
        }
    }
    
    deleteNote() {
        if (!this.currentNoteId) return;
        
        if (confirm('Are you sure you want to delete this note?')) {
            this.noteManager.deleteNote(this.currentNoteId);
            this.renderNotes();
            this.updateStats();
            this.hideModal();
            
            // If we were in search view, update search results
            if (this.currentView === 'search') {
                const query = document.getElementById('search-input').value;
                if (query) {
                    this.performSearch(query);
                }
            }
        }
    }
    
    deleteCardNote(noteId) {
        const note = this.noteManager.getNoteById(noteId);
        if (!note) return;
        
        // Create a meaningful confirmation message based on available content
        const title = note.title?.trim();
        const content = this.stripHtml(note.content || '').trim();
        
        let confirmMessage;
        if (title) {
            confirmMessage = `Are you sure you want to delete "${title}"?`;
        } else if (content) {
            // Use first 30 characters of content if no title
            const previewText = content.length > 30 ? content.substring(0, 30) + '...' : content;
            confirmMessage = `Are you sure you want to delete this note?\n\n"${previewText}"`;
        } else {
            confirmMessage = 'Are you sure you want to delete this empty note?';
        }
        
        if (confirm(confirmMessage)) {
            this.noteManager.deleteNote(noteId);
            this.renderNotes();
            this.updateStats();
            
            // If we were in search view, update search results
            if (this.currentView === 'search') {
                const query = document.getElementById('search-input').value;
                if (query) {
                    this.performSearch(query);
                }
            }
        }
    }
    
    changeNoteColor(noteId, color) {
        this.noteManager.updateNote(noteId, { backgroundColor: color });
        
        // Update the specific card instead of re-rendering all notes
        const card = document.querySelector(`[data-note-id="${noteId}"]`);
        if (card) {
            this.updateCardBackgroundColor(card, color);
            
            // Re-layout masonry since card might have different height with new color
            setTimeout(() => {
                const grid = document.getElementById('notes-grid');
                const cards = Array.from(grid.querySelectorAll('.note-card'));
                if (cards.length > 0) {
                    this.masonryLayout.relayout(grid, cards);
                }
            }, 50);
        }
        
        // If we were in search view, also update search results
        if (this.currentView === 'search') {
            const searchCard = document.querySelector(`#search-results [data-note-id="${noteId}"]`);
            if (searchCard) {
                this.updateCardBackgroundColor(searchCard, color);
                
                // Re-layout search results masonry
                setTimeout(() => {
                    const container = document.getElementById('results-container');
                    const cards = Array.from(container.querySelectorAll('.note-card'));
                    if (cards.length > 0) {
                        this.masonryLayout.relayout(container, cards);
                    }
                }, 50);
            }
        }
    }
    
    updateCardBackgroundColor(card, color) {
        // Map color names to CSS variables
        const colorMap = {
            'white': 'var(--white)',
            'yellow': 'var(--note-yellow)',
            'orange': 'var(--note-orange)',
            'pink': 'var(--note-pink)',
            'purple': 'var(--note-purple)',
            'blue': 'var(--note-blue)',
            'green': 'var(--note-green)'
        };
        
        card.style.backgroundColor = colorMap[color] || colorMap['white'];
    }
    
    performSearch(query) {
        if (!query || query.length < CONFIG.minSearchLength) {
            this.showView('notes');
            return;
        }
        
        const results = this.searchEngine.search(query);
        this.renderSearchResults(results);
    }
    
    renderSearchResults(results) {
        const container = document.getElementById('results-container');
        container.innerHTML = '';
        
        document.getElementById('results-number').textContent = results.length;
        
        if (results.length === 0) {
            container.innerHTML = `
                <div style="padding: 2rem; text-align: center; color: var(--gray-500);">
                    <p>No notes found. Try different keywords.</p>
                </div>
            `;
        } else {
            // Create all cards first
            const cards = [];
            results.forEach(note => {
                const card = this.createNoteCard(note);
                container.appendChild(card);
                cards.push(card);
            });
            
            // Apply masonry layout to search results
            if (cards.length > 0) {
                setTimeout(() => {
                    this.masonryLayout.layout(container, cards);
                    this.setupSearchMasonryResize();
                }, 0);
            }
        }
        
        this.showView('search');
    }
    
    setupMasonryResize() {
        const grid = document.getElementById('notes-grid');
        this.masonryLayout.setupAutoResize(grid, () => {
            return Array.from(grid.querySelectorAll('.note-card'));
        });
    }
    
    setupSearchMasonryResize() {
        const container = document.getElementById('results-container');
        this.masonryLayout.setupAutoResize(container, () => {
            return Array.from(container.querySelectorAll('.note-card'));
        });
    }

    showView(view) {
        // Hide all views
        document.getElementById('notes-view').style.display = 'none';
        document.getElementById('search-results').style.display = 'none';
        
        // Show requested view
        switch(view) {
            case 'notes':
                document.getElementById('notes-view').style.display = 'block';
                this.checkEmptyState();
                break;
            case 'search':
                document.getElementById('search-results').style.display = 'block';
                break;
        }
        
        this.currentView = view;
    }
    
    checkEmptyState() {
        const emptyState = document.getElementById('empty-state');
        const notesGrid = document.getElementById('notes-grid');
        
        if (this.noteManager.notes.length === 0) {
            emptyState.style.display = 'flex';
            notesGrid.style.display = 'none';
        } else {
            emptyState.style.display = 'none';
            notesGrid.style.display = 'grid';
        }
    }
    
    initializeModalFeatures() {
        if (this.isTouchDevice) {
            console.log('Touch device detected - disabling modal drag/resize features');
            return;
        }

        const modal = document.getElementById('note-modal');
        const titleBar = document.querySelector('.modal-title-bar');
        const resizeHandle = document.querySelector('.modal-resize-handle');
        const modalContent = document.querySelector('.modal-content');

        if (!modal || !titleBar || !resizeHandle || !modalContent) {
            console.error('Modal elements not found for drag/resize features');
            return;
        }

        // Initialize modal positioning
        this.centerModal();

        // Setup dragging
        titleBar.addEventListener('mousedown', (e) => this.startModalDrag(e));
        
        // Setup double-click fullscreen toggle
        titleBar.addEventListener('dblclick', (e) => this.toggleModalFullscreen(e));
        
        // Setup resizing
        resizeHandle.addEventListener('mousedown', (e) => this.startModalResize(e));
        
        // Global mouse events
        document.addEventListener('mousemove', (e) => this.handleModalMouseMove(e));
        document.addEventListener('mouseup', () => this.stopModalDragResize());
        
        // Keyboard events for center resize mode
        document.addEventListener('keydown', (e) => this.handleModalKeyDown(e));
        document.addEventListener('keyup', (e) => this.handleModalKeyUp(e));
    }

    setupFullscreenButton() {
        const fullscreenButton = document.getElementById('fullscreen-toggle');
        if (fullscreenButton && !this.isTouchDevice) {
            // Remove any existing listeners
            fullscreenButton.removeEventListener('click', this.fullscreenButtonHandler);
            
            // Create bound handler
            this.fullscreenButtonHandler = (e) => {
                e.preventDefault();
                e.stopPropagation(); // Prevent double-click event
                console.log('Fullscreen button clicked');
                this.toggleModalFullscreen(e);
            };
            
            // Add event listener
            fullscreenButton.addEventListener('click', this.fullscreenButtonHandler);
            console.log('Fullscreen button event listener attached');
        }
    }

    centerModal() {
        const modal = document.getElementById('note-modal');
        const modalContent = document.querySelector('.modal-content');
        
        if (!modal || !modalContent) return;
        
        modal.classList.add('floating');
        
        // Center the modal
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const modalWidth = 650;
        const modalHeight = 500;
        
        const left = Math.max(20, (viewportWidth - modalWidth) / 2);
        const top = Math.max(20, (viewportHeight - modalHeight) / 2);
        
        modalContent.style.left = `${left}px`;
        modalContent.style.top = `${top}px`;
        modalContent.style.width = `${modalWidth}px`;
        modalContent.style.height = `${modalHeight}px`;
    }

    startModalDrag(e) {
        if (e.target.closest('.title-bar-action')) {
            return; // Don't drag when clicking action buttons
        }
        
        // Don't allow dragging when maximized
        if (this.modalIsMaximized) {
            return;
        }
        
        e.preventDefault();
        this.modalDragging = true;
        
        const modalContent = document.querySelector('.modal-content');
        const titleBar = document.querySelector('.modal-title-bar');
        
        titleBar.classList.add('dragging');
        
        const rect = modalContent.getBoundingClientRect();
        this.dragOffset.x = e.clientX - rect.left;
        this.dragOffset.y = e.clientY - rect.top;
        
        // Disable overlay click-to-close while dragging
        const overlay = document.querySelector('.modal-overlay');
        overlay.style.pointerEvents = 'none';
    }

    startModalResize(e) {
        e.preventDefault();
        this.modalResizing = true;
        
        const modalContent = document.querySelector('.modal-content');
        const rect = modalContent.getBoundingClientRect();
        
        this.modalStartPos.x = e.clientX;
        this.modalStartPos.y = e.clientY;
        this.modalStartSize.width = rect.width;
        this.modalStartSize.height = rect.height;
        this.modalStartCenter = {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2
        };
    }

    handleModalMouseMove(e) {
        if (this.modalDragging) {
            this.handleModalDrag(e);
        } else if (this.modalResizing) {
            this.handleModalResize(e);
        }
    }

    handleModalDrag(e) {
        const modalContent = document.querySelector('.modal-content');
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        let newX = e.clientX - this.dragOffset.x;
        let newY = e.clientY - this.dragOffset.y;
        
        const modalRect = modalContent.getBoundingClientRect();
        
        // Constrain to viewport with 20px margin
        newX = Math.max(20, Math.min(newX, viewportWidth - modalRect.width - 20));
        newY = Math.max(20, Math.min(newY, viewportHeight - modalRect.height - 20));
        
        modalContent.style.left = `${newX}px`;
        modalContent.style.top = `${newY}px`;
    }

    handleModalResize(e) {
        const modalContent = document.querySelector('.modal-content');
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        const deltaX = e.clientX - this.modalStartPos.x;
        const deltaY = e.clientY - this.modalStartPos.y;
        
        let newWidth = this.modalStartSize.width + deltaX;
        let newHeight = this.modalStartSize.height + deltaY;
        
        // Apply constraints
        const minWidth = 400;
        const minHeight = 300;
        const maxWidth = viewportWidth - 40; // 20px margin on each side
        const maxHeight = viewportHeight - 40;
        
        newWidth = Math.max(minWidth, Math.min(newWidth, maxWidth));
        newHeight = Math.max(minHeight, Math.min(newHeight, maxHeight));
        
        if (e.ctrlKey) {
            // Center resize mode - expand from center
            const widthDiff = newWidth - this.modalStartSize.width;
            const heightDiff = newHeight - this.modalStartSize.height;
            
            // Calculate new position to keep center aligned
            const newLeft = this.modalStartCenter.x - newWidth / 2;
            const newTop = this.modalStartCenter.y - newHeight / 2;
            
            // Ensure the modal stays within viewport bounds
            const constrainedLeft = Math.max(20, Math.min(newLeft, viewportWidth - newWidth - 20));
            const constrainedTop = Math.max(20, Math.min(newTop, viewportHeight - newHeight - 20));
            
            // If position constraints would prevent proper centering, adjust size accordingly
            if (constrainedLeft !== newLeft || constrainedTop !== newTop) {
                const maxCenteredWidth = Math.min(newWidth, (viewportWidth - 40));
                const maxCenteredHeight = Math.min(newHeight, (viewportHeight - 40));
                
                newWidth = Math.max(minWidth, maxCenteredWidth);
                newHeight = Math.max(minHeight, maxCenteredHeight);
                
                modalContent.style.left = `${Math.max(20, (viewportWidth - newWidth) / 2)}px`;
                modalContent.style.top = `${Math.max(20, (viewportHeight - newHeight) / 2)}px`;
            } else {
                modalContent.style.left = `${constrainedLeft}px`;
                modalContent.style.top = `${constrainedTop}px`;
            }
        }
        
        modalContent.style.width = `${newWidth}px`;
        modalContent.style.height = `${newHeight}px`;
        
        // Update rich text editor height
        this.updateEditorHeight(newHeight);
    }

    updateEditorHeight(modalHeight) {
        const richTextEditor = document.querySelector('.rich-text-editor');
        if (!richTextEditor) return;
        
        // Calculate available height for editor
        // Modal padding, title bar, toolbar, etc. take up about 200px
        const availableHeight = modalHeight - 200;
        const minHeight = 150;
        const maxHeight = Math.max(minHeight, availableHeight);
        
        richTextEditor.style.maxHeight = `${maxHeight}px`;
        
        // Update custom scrollbar if rich text editor exists
        if (this.richTextEditor) {
            setTimeout(() => {
                this.richTextEditor.updateScrollbar();
            }, 10);
        }
    }

    handleModalKeyDown(e) {
        if (e.key === 'Control') {
            const resizeHandle = document.querySelector('.modal-resize-handle');
            if (resizeHandle) {
                resizeHandle.classList.add('center-resize');
            }
        }
    }

    handleModalKeyUp(e) {
        if (e.key === 'Control') {
            const resizeHandle = document.querySelector('.modal-resize-handle');
            if (resizeHandle) {
                resizeHandle.classList.remove('center-resize');
            }
        }
    }

    toggleModalFullscreen(e) {
        console.log('toggleModalFullscreen called', e.target);
        
        // Allow toggle when clicking the fullscreen button specifically
        if (e.target.closest('#fullscreen-toggle')) {
            console.log('Fullscreen button clicked - allowing toggle');
        } else if (e.target.closest('.title-bar-action')) {
            console.log('Other title bar action clicked - blocking toggle');
            return; // Don't toggle when clicking other action buttons
        }
        
        e.preventDefault();
        
        const modalContent = document.querySelector('.modal-content');
        if (!modalContent) return;
        
        console.log('Current maximized state:', this.modalIsMaximized);
        
        if (this.modalIsMaximized) {
            // Restore previous size and position
            this.restoreModal();
        } else {
            // Maximize modal
            this.maximizeModal();
        }
    }

    maximizeModal() {
        const modalContent = document.querySelector('.modal-content');
        if (!modalContent) return;
        
        // Store current state for restoration
        const rect = modalContent.getBoundingClientRect();
        this.modalRestoreState = {
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height
        };
        
        // Calculate maximized dimensions (with 20px margins)
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const maxWidth = viewportWidth - 40;
        const maxHeight = viewportHeight - 40;
        
        // Apply maximized state
        modalContent.style.left = '20px';
        modalContent.style.top = '20px';
        modalContent.style.width = `${maxWidth}px`;
        modalContent.style.height = `${maxHeight}px`;
        
        // Update editor height for maximized state
        this.updateEditorHeight(maxHeight);
        
        // Mark as maximized
        this.modalIsMaximized = true;
        modalContent.classList.add('maximized');
        
        // Update fullscreen button
        this.updateFullscreenButton(true);
        
        console.log('Modal maximized');
    }

    restoreModal() {
        const modalContent = document.querySelector('.modal-content');
        if (!modalContent || !this.modalRestoreState) return;
        
        // Restore previous state
        modalContent.style.left = `${this.modalRestoreState.left}px`;
        modalContent.style.top = `${this.modalRestoreState.top}px`;
        modalContent.style.width = `${this.modalRestoreState.width}px`;
        modalContent.style.height = `${this.modalRestoreState.height}px`;
        
        // Update editor height for restored state
        this.updateEditorHeight(this.modalRestoreState.height);
        
        // Mark as not maximized
        this.modalIsMaximized = false;
        modalContent.classList.remove('maximized');
        this.modalRestoreState = null;
        
        // Update fullscreen button
        this.updateFullscreenButton(false);
        
        console.log('Modal restored to previous size');
    }

    updateFullscreenButton(isMaximized) {
        const fullscreenButton = document.getElementById('fullscreen-toggle');
        if (!fullscreenButton) return;
        
        const icon = fullscreenButton.querySelector('i');
        if (!icon) return;
        
        if (isMaximized) {
            // Change to "minimize" icon and add maximized class
            icon.className = 'ph ph-corners-in';
            fullscreenButton.classList.add('maximized');
            fullscreenButton.title = 'Restore Size';
        } else {
            // Change to "maximize" icon and remove maximized class
            icon.className = 'ph ph-corners-out';
            fullscreenButton.classList.remove('maximized');
            fullscreenButton.title = 'Toggle Fullscreen';
        }
    }

    stopModalDragResize() {
        this.modalDragging = false;
        this.modalResizing = false;
        
        const titleBar = document.querySelector('.modal-title-bar');
        const overlay = document.querySelector('.modal-overlay');
        const resizeHandle = document.querySelector('.modal-resize-handle');
        
        if (titleBar) {
            titleBar.classList.remove('dragging');
        }
        
        if (resizeHandle) {
            resizeHandle.classList.remove('center-resize');
        }
        
        // Re-enable overlay click-to-close
        if (overlay) {
            overlay.style.pointerEvents = '';
        }
    }

    showModal() {
        document.getElementById('note-modal').style.display = 'flex';
        document.body.style.overflow = 'hidden';
        
        // Initialize floating modal if not touch device
        if (!this.isTouchDevice) {
            this.centerModal();
        }
        
        // Update status bar when modal opens
        this.updateStatusBar();
        
        // Setup fullscreen button
        this.setupFullscreenButton();
        
        // Initialize rich text editor scrollbar when showing modal
        setTimeout(() => {
            if (this.richTextEditor) {
                this.richTextEditor.updateScrollbar();
            }
        }, 50);
        
        // Setup auto-save
        this.setupAutoSave();
    }
    
    hideModal() {
        document.getElementById('note-modal').style.display = 'none';
        document.body.style.overflow = '';
        
        // Reset modal state
        const modal = document.getElementById('note-modal');
        const modalContent = document.querySelector('.modal-content');
        
        if (modal) {
            modal.classList.remove('floating');
        }
        
        if (modalContent) {
            modalContent.classList.remove('maximized');
        }
        
        // Reset fullscreen state
        this.modalIsMaximized = false;
        this.modalRestoreState = null;
        this.updateFullscreenButton(false);
        
        this.stopModalDragResize();
    }
    
    setupAutoSave() {
        let lastWordCount = 0;
        let timer = null;
        
        const autoSave = () => {
            const title = document.getElementById('note-title').value.trim();
            const content = this.richTextEditor ? this.richTextEditor.getContent() : '';
            const wordCount = (title + ' ' + this.stripHtml(content)).trim().split(/\s+/).length;
            
            if (wordCount - lastWordCount >= CONFIG.autoSaveWordThreshold) {
                this.saveNote();
                lastWordCount = wordCount;
            }
        };
        
        const handleInput = () => {
            clearTimeout(timer);
            timer = setTimeout(autoSave, 200000);
            this.updateStatusBar(); // Update status bar on input
        };
        
        document.getElementById('note-title').addEventListener('input', handleInput);
        document.getElementById('note-content').addEventListener('input', handleInput);
    }
    
    updateStats() {
        const totalNotesEl = document.getElementById('total-notes');
        if (totalNotesEl) {
            totalNotesEl.textContent = this.noteManager.notes.length;
        }
    }

    updateStatusBar() {
        const wordCountEl = document.getElementById('word-count');
        const charCountEl = document.getElementById('char-count');
        
        if (!wordCountEl || !charCountEl) return;
        
        // Get content from editor
        const editor = document.getElementById('note-content');
        if (!editor) return;
        
        const text = editor.textContent || editor.innerText || '';
        
        // Simple word count - split by whitespace and filter empty strings
        const words = text.trim().split(/\s+/).filter(word => word.length > 0);
        const wordCount = text.trim() === '' ? 0 : words.length;
        
        // Character count (excluding excessive whitespace)
        const charCount = text.length;
        
        // Update display
        wordCountEl.textContent = wordCount;
        charCountEl.textContent = charCount;
    }
    
    attachEventListeners() {
        // Search input
        const searchInput = document.getElementById('search-input');
        const clearButton = document.getElementById('clear-search');
        
        if (!searchInput || !clearButton) {
            console.error('Search elements not found in DOM');
            return;
        }
        
        let searchTimeout;
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value;
            
            // Show/hide clear button
            clearButton.style.display = query ? 'block' : 'none';
            
            // Debounce search
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                this.performSearch(query);
            }, CONFIG.debounceDelay);
        });
        
        // Clear search
        clearButton.addEventListener('click', () => {
            searchInput.value = '';
            clearButton.style.display = 'none';
            this.showView('notes');
        });
        
        // Add note button
        const addNoteBtn = document.getElementById('add-note-btn');
        if (addNoteBtn) {
            addNoteBtn.addEventListener('click', () => this.createNewNote());
        }
        
        // Add first note button (empty state)
        const addFirstNoteBtn = document.querySelector('.add-first-note-btn');
        if (addFirstNoteBtn) {
            addFirstNoteBtn.addEventListener('click', () => this.createNewNote());
        }
        
        // Save note button
        const saveNoteBtn = document.getElementById('save-note');
        if (saveNoteBtn) {
            saveNoteBtn.addEventListener('click', () => this.saveNote());
        }
        
        // Delete note button
        const deleteNoteBtn = document.getElementById('delete-note');
        if (deleteNoteBtn) {
            deleteNoteBtn.addEventListener('click', () => this.deleteNote());
        }
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Focus search on '/'
            if (e.key === '/' && document.activeElement !== searchInput) {
                e.preventDefault();
                searchInput.focus();
            }
            
            // Rich text shortcuts are now handled by RichTextEditor class
            
            // Save note on Ctrl+S or Cmd+S (when modal is open)
            const isModalOpen = document.getElementById('note-modal').style.display === 'flex';
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                if (isModalOpen) {
                    e.preventDefault();
                    this.saveNote();
                }
            }
            
            // Close modal on Escape
            if (e.key === 'Escape') {
                if (isModalOpen) {
                    this.hideModal();
                } else if (searchInput.value) {
                    searchInput.value = '';
                    this.showView('notes');
                }
            }
        });
        
        // Focus search input on load
        searchInput.focus();
        
        // Close color pickers when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.card-color-picker')) {
                const openColorPickers = document.querySelectorAll('.color-options.visible');
                openColorPickers.forEach(picker => {
                    picker.classList.remove('visible');
                });
            }
        });
    }
    
    // Rich text functionality moved to RichTextEditor class
    
    // Utility functions
    truncateText(text, maxLength) {
        if (text.length <= maxLength) return text;
        return text.substr(0, maxLength) + '...';
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    stripHtml(html) {
        const div = document.createElement('div');
        div.innerHTML = html;
        return div.textContent || div.innerText || '';
    }
    
    formatTimeAgo(timestamp) {
        const now = Date.now();
        const diff = now - timestamp;
        
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);
        
        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        if (days < 7) return `${days}d ago`;
        
        const date = new Date(timestamp);
        return date.toLocaleDateString();
    }
}

// CustomScrollbar class moved to RichTextEditor.js

// ==== GLOBAL FUNCTIONS ====
function closeNoteModal() {
    app.uiManager.hideModal();
}

// ==== APPLICATION INITIALIZATION ====
class KeepNote {
    constructor() {
        this.noteManager = new NoteManager();
        this.searchEngine = null;
        this.uiManager = null;
    }
    
    init() {
        // Load data
        const loaded = this.noteManager.loadNotes();
        if (!loaded) {
            console.warn('Failed to load notes, starting fresh');
        }
        
        // Initialize components
        this.searchEngine = new SearchEngine(this.noteManager);
        this.uiManager = new UIManager(this.noteManager, this.searchEngine);
        
        // Initialize UI
        this.uiManager.init();
        
        console.log('KeepNote initialized successfully');
        console.log(`Loaded ${this.noteManager.notes.length} notes`);
    }
}

// ==== START APPLICATION ====
let app;

document.addEventListener('DOMContentLoaded', () => {
    app = new KeepNote();
    window.app = app; // Make globally accessible for debugging
    app.init();
});

// Export for debugging
window.KeepNote = {
    app,
    CONFIG
};

