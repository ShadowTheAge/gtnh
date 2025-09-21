import { PageModel, serializer, SetCurrentPage, addProjectChangeListener, page, UpdateProject, ModelObjectValidator } from './page.js';
import { showConfirmDialog } from './dialogues.js';
import { ShowNei, ShowNeiMode } from "./nei.js";

async function ValidateAndNotify(page: PageModel): Promise<void> {
    const validator = new ModelObjectValidator();
    const errors = validator.Validate(page);

    const missing = errors.missingRecipe || 0;
    const changed = errors.changedRecipe || 0;

    if (missing > 0 || changed > 0) {
        let message = "The page you are about to load contains:";
        if (missing > 0) {
            message += `\n- ${missing} missing recipe(s)`;
            message += `\nA missing recipe is a recipe that was deleted or substantially changed. These recipes will be displayed as missing and must be deleted or replaced.\n`;
        }
        if (changed > 0) {
            message += `\n- ${changed} changed recipe(s)`;
            message += `\nA changed recipe is a recipe that was changed a bit and might break, but uses and produces the same items as before. These recipes were replaced with the best matching recipes.\n`;
        }
        message += `This is likely caused by the game version change.`;

        await showConfirmDialog(
            message,
            "OK",
            null,
            null
        );
    }
}

export class PageManager {
    private pages: string[] = [];
    private currentPage: string | null = null;
    private pageListContainer: HTMLElement;
    private pageCache: Map<string, PageModel> = new Map();
    private undoInProgress: boolean = false;

    constructor() {
        this.pageListContainer = document.querySelector('.page-list')!;
        this.loadPagesFromStorage();
        this.render();
        this.loadFirstPage();
        this.setupEventListeners();
        this.setupPageChangeListener();
        this.setupUndoHandler();
        this.setupUrlHashHandler();
        this.setupFileLoadHandler();
    }

    private setupUndoHandler() {
        document.addEventListener("keydown", (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
                e.preventDefault();
                this.undo();
            }
        });
    }

    private setupPageChangeListener() {
        addProjectChangeListener(() => {
            if (this.currentPage && page) {
                const serialized = JSON.stringify(serializer.Serialize(page));
                localStorage.setItem(`p:${this.currentPage}`, serialized);
                this.pageCache.set(this.currentPage, page);
                if (!this.undoInProgress) {
                    page.addToHistory(serialized);
                }
            }
        });
    }

    private setupEventListeners() {
        this.pageListContainer.addEventListener('click', (e) => {
            const target = e.target as HTMLElement;
            const action = target.dataset.action;
            if (action === "switch-page") {
                const pageName = target.dataset.pageName;
                if (pageName) this.switchPage(pageName);
            } else if (action === "delete-page") {
                const pageName = target.dataset.pageName;
                if (pageName) this.deletePage(pageName);
            }
        });

        // Add NEI link handler
        document.getElementById('nei-link')?.addEventListener('click', (e) => {
            e.preventDefault();
            ShowNei(null, ShowNeiMode.Production, null);
        });

        this.pageListContainer.addEventListener('blur', (e) => {
            const target = e.target as HTMLElement;
            if (target.matches('[data-action="rename-page"]')) {
                const input = target as HTMLInputElement;
                const oldName = input.dataset.pageName;
                const newName = input.value.trim();
                
                if (oldName && newName && oldName !== newName) {
                    this.renamePage(oldName, newName);
                }
            }
        }, true);

        this.pageListContainer.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const target = e.target as HTMLElement;
                if (target.matches('[data-action="rename-page"]')) {
                    target.blur();
                }
            }
        }, true);

        document.querySelector('[data-action="create-page"]')?.addEventListener('click', () => {
            const input = document.querySelector('[data-action="page-name-input"]') as HTMLInputElement;
            let name = input.value.trim();
            if (!name) name = "New";
            this.createNewPage(name);
            input.value = '';
        });
    }

    private loadPagesFromStorage() {
        this.pages = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i)!;
            if (key.startsWith('p:')) {
                console.log("Found page", key);
                this.pages.push(key.substring(2));
            }
        }
        this.pages.sort();
    }

    private render() {
        this.pageListContainer.innerHTML = '';

        this.pages.forEach(pageName => {
            if (pageName === this.currentPage) {
                const container = document.createElement('div');
                container.className = 'active-page';

                const input = document.createElement('input');
                input.type = 'text';
                input.value = pageName;
                input.setAttribute('data-action', 'rename-page');
                input.setAttribute('data-page-name', pageName);

                const button = document.createElement('button');
                button.className = 'delete-btn';
                button.textContent = 'x';
                button.setAttribute('data-action', 'delete-page');
                button.setAttribute('data-page-name', pageName);

                container.appendChild(input);
                container.appendChild(button);
                this.pageListContainer.appendChild(container);
            } else {
                const button = document.createElement('button');
                button.className = 'page-button';
                button.textContent = pageName;
                button.setAttribute('data-action', 'switch-page');
                button.setAttribute('data-page-name', pageName);

                this.pageListContainer.appendChild(button);
            }
        });
    }

    private loadFirstPage() {
        if (this.pages.length > 0) {
            this.switchPage(this.pages[0]);
        } else {
            this.createNewPage('New');
        }
    }

    private switchPage(pageName: string) {
        if (this.currentPage === pageName) return;
        
        this.currentPage = pageName;
        
        // Try to get page from cache first
        let page = this.pageCache.get(pageName);
        
        if (!page) {
            // If not in cache, load from localStorage
            const stored = localStorage.getItem(`p:${pageName}`);
            if (stored) {
                page = new PageModel(JSON.parse(stored));
                ValidateAndNotify(page);
                page.name = pageName;
                this.pageCache.set(pageName, page);
                // Initialize history with the loaded state
                page.addToHistory(stored);
            }
        }
        
        if (page) {
            SetCurrentPage(page);
            // Update window title
            document.title = `${page.name} - GTNH calculator`;
        }
        
        this.render();
    }

    private createNewPage(pageName: string) {
        let finalName = pageName;
        let counter = 1;
        while (this.pages.includes(finalName)) {
            finalName = `${pageName} ${counter}`;
            counter++;
        }
        
        const page = new PageModel();
        page.name = finalName;
        const serialized = JSON.stringify(serializer.Serialize(page));
        localStorage.setItem(`p:${finalName}`, serialized);
        
        this.pages.push(finalName);
        this.pages.sort();
        this.pageCache.set(finalName, page);
        // Initialize history with the initial state
        page.addToHistory(serialized);
        this.switchPage(finalName);
        this.render();
    }

    private undo() {
        if (page && page.undo()) {
            this.undoInProgress = true;
            // After undo, update the cache and localStorage
            const serialized = JSON.stringify(serializer.Serialize(page));
            if (this.currentPage) {
                localStorage.setItem(`p:${this.currentPage}`, serialized);
                this.pageCache.set(this.currentPage, page);
            }
            // Notify listeners about the change
            UpdateProject();
            this.undoInProgress = false;
        }
    }

    private setupUrlHashHandler() {
        window.addEventListener('hashchange', () => this.handleUrlHashChange());
        this.handleUrlHashChange();
    }

    private async handleUrlHashChange() {
        const hash = window.location.hash.slice(1); // Remove the # symbol
        if (!hash) return;

        try {
            // Convert from URL-safe base64 back to normal base64
            const base64 = hash.replace(/-/g, '+').replace(/_/g, '/');
            // Decode base64
            const compressed = atob(base64);
            // Decompress
            const data = new Uint8Array(compressed.split('').map(c => c.charCodeAt(0)));
            const decompressedStream = new DecompressionStream('deflate');
            const writer = decompressedStream.writable.getWriter();
            writer.write(data);
            writer.close();
            const decompressed = await new Response(decompressedStream.readable).arrayBuffer();
            const json = new TextDecoder().decode(decompressed);
            console.log("Loaded page", json);
            const importedPage = new PageModel(JSON.parse(json));
            await ValidateAndNotify(importedPage);
            window.location.hash = "";
            this.importPage(importedPage);
        } catch (e) {
            console.error("Failed to load from URL fragment:", e);
        }
    }

    private generateUniquePageName(baseName: string): string {
        let finalName = baseName;
        let counter = 1;
        while (this.pages.includes(finalName)) {
            finalName = `${baseName} ${counter}`;
            counter++;
        }
        return finalName;
    }

    public importPage(model: PageModel) {
        if (!model.name) return;

        const existingIndex = this.pages.indexOf(model.name);
        if (existingIndex !== -1) {
            // Page with this name exists
            showConfirmDialog(
                `A page named "${model.name}" already exists. What would you like to do?`,
                "Create New",
                "Replace Existing",
                "Cancel"
            ).then(action => {
                if (action === "option1") {
                    const newName = this.generateUniquePageName(model.name);
                    this.saveAndSwitchToPage(newName, model);
                } else if (action === "option2") {
                    // Replace existing page
                    this.saveAndSwitchToPage(model.name, model);
                }
                // If cancel, do nothing
            });
        } else {
            // New page name
            this.saveAndSwitchToPage(model.name, model);
        }
    }

    private saveAndSwitchToPage(pageName: string, model: PageModel) {
        const serialized = JSON.stringify(serializer.Serialize(model));
        localStorage.setItem(`p:${pageName}`, serialized);
        
        if (!this.pages.includes(pageName)) {
            this.pages.push(pageName);
            this.pages.sort();
        }
        
        this.pageCache.set(pageName, model);
        model.addToHistory(serialized);
        this.switchPage(pageName);
        this.render();
    }

    private renamePage(oldName: string, newName: string) {
        const page = this.pageCache.get(oldName);
        if (!page) return;

        let finalName = newName;
        if (this.pages.includes(newName)) {
            finalName = this.generateUniquePageName(newName);
        }

        // Remove from old name
        localStorage.removeItem(`p:${oldName}`);
        this.pageCache.delete(oldName);
        const oldIndex = this.pages.indexOf(oldName);
        if (oldIndex !== -1) {
            this.pages.splice(oldIndex, 1);
        }

        // Add to new name
        page.name = finalName;
        const serialized = JSON.stringify(serializer.Serialize(page));
        localStorage.setItem(`p:${finalName}`, serialized);
        this.pageCache.set(finalName, page);
        this.pages.push(finalName);
        this.pages.sort();
        
        // Update current page if needed
        if (this.currentPage === oldName) {
            this.currentPage = finalName;
            // Update window title
            document.title = `${page.name} - GTNH calculator`;
        }

        this.render();
    }

    private setupFileLoadHandler() {
        const loadFileLink = document.getElementById('load-file');
        if (!loadFileLink) return;

        loadFileLink.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Create file input
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.gtnh';
            
            input.onchange = async (e) => {
                const file = (e.target as HTMLInputElement).files?.[0];
                if (!file) return;

                try {
                    const text = await file.text();
                    const json = JSON.parse(text);
                    const pageModel = new PageModel(json);
                    await ValidateAndNotify(pageModel);
                    this.importPage(pageModel);
                } catch (error) {
                    console.error('Failed to load file:', error);
                    // TODO: Show error to user
                }
            };

            input.click();
        });
    }

    private deletePage(pageName: string) {
        showConfirmDialog(
            `You are deleting page "${pageName}". This action cannot be undone. Are you sure you want to continue?`,
            `Delete ${pageName}`,
            null,
            `Cancel`
        ).then(action => {
            if (action === "option1") {
                // Remove from storage
                localStorage.removeItem(`p:${pageName}`);
                // Remove from cache
                this.pageCache.delete(pageName);
                // Remove from pages list
                const index = this.pages.indexOf(pageName);
                if (index !== -1) {
                    this.pages.splice(index, 1);
                }
                // Switch to first page or create new one
                if (this.pages.length > 0) {
                    this.switchPage(this.pages[0]);
                } else {
                    this.createNewPage('New');
                }
                this.render();
            }
        });
    }
}

new PageManager();

// Menu toggle functionality
const menuToggle: HTMLElement | null = document.querySelector('.menu-toggle')!;
const menu: HTMLElement | null = document.getElementById('menu')!;

menuToggle.addEventListener('click', (): void => {
    menu.classList.toggle('visible');
});

// Close menu when clicking outside
document.addEventListener('click', (e: MouseEvent): void => {
    const target: HTMLElement = e.target as HTMLElement;
    if (!menu.contains(target) && !menuToggle.contains(target)) {
        menu.classList.remove('visible');
    }
});