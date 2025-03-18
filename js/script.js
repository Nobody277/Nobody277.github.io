// Load additional script files
function loadScript(url) {
    return new Promise((resolve, reject) => {
        // Check if the script is already loaded
        if (document.querySelector(`script[src="${url}"]`)) {
            resolve();
            return;
        }

        const script = document.createElement('script');
        script.src = url;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error(`Failed to load script: ${url}`));
        document.head.appendChild(script);
    });
}

// Load all required scripts before initializing
Promise.all([
    loadScript('js/class-diagram.js'),
    loadScript('js/flowchart.js')
]).then(() => {
    console.log('All diagram scripts loaded successfully');
}).catch(error => {
    console.error('Error loading diagram scripts:', error);
});

document.addEventListener('DOMContentLoaded', function() {
    // Elements for tabs
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabPanels = document.querySelectorAll('.tab-panel');
    
    // Elements for Class Diagram tab
    const classGenerateBtn = document.getElementById('class-generate-btn');
    const classUploadBtn = document.getElementById('class-upload-btn');
    const classFileUpload = document.getElementById('class-file-upload');
    const classFileList = document.getElementById('class-file-list');
    const classDownloadBtn = document.getElementById('class-download-png-btn');
    const javaCodeTextarea = document.getElementById('java-code');
    const classDiagramOutput = document.getElementById('class-diagram-output');
    
    // Initialize diagram generators
    let classDiagramGenerator;
    
    // Initialize after a short delay to ensure scripts are loaded
    setTimeout(() => {
        try {
            classDiagramGenerator = new ClassDiagramGenerator();
            console.log('Class diagram generator initialized successfully');
        } catch (error) {
            console.error('Error initializing class diagram generator:', error);
        }
    }, 500);
    
    // Initialize variables to track state
    let selectedFiles = [];
    
    // Tab switching
    tabBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            // Remove active class from all tabs and panels
            tabBtns.forEach(tab => {
                tab.classList.remove('active');
                tab.setAttribute('aria-selected', 'false');
            });
            
            tabPanels.forEach(panel => {
                panel.classList.remove('active');
                panel.style.display = 'none';
            });
            
            // Add active class to clicked tab
            this.classList.add('active');
            this.setAttribute('aria-selected', 'true');
            
            // Show corresponding panel
            const tabId = this.getAttribute('data-tab');
            const targetPanel = document.getElementById(`${tabId}-panel`);
            if (targetPanel) {
                targetPanel.classList.add('active');
                targetPanel.style.display = 'block';
            }
        });
    });
    
    // Trigger file upload when the upload button is clicked
    classUploadBtn.addEventListener('click', function() {
        classFileUpload.click();
    });
    
    // Handle file selection
    classFileUpload.addEventListener('change', function(e) {
        const files = Array.from(e.target.files);
        
        if (files.length > 0) {
            // Clear the textarea if files are uploaded
            javaCodeTextarea.value = '';
            
            // Add files to our tracking array
            selectedFiles = [...selectedFiles, ...files];
            
            // Display selected files in the list
            updateFileList();
        }
    });
    
    // Update the file list display
    function updateFileList() {
        classFileList.innerHTML = '';
        
        selectedFiles.forEach((file, index) => {
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item';
            
            const fileName = document.createElement('div');
            fileName.className = 'file-name';
            fileName.innerHTML = `<i class="fas fa-file-code"></i>${file.name}`;
            
            const removeBtn = document.createElement('span');
            removeBtn.className = 'remove-file';
            removeBtn.innerHTML = '<i class="fas fa-times"></i>';
            removeBtn.addEventListener('click', () => {
                selectedFiles.splice(index, 1);
                updateFileList();
            });
            
            fileItem.appendChild(fileName);
            fileItem.appendChild(removeBtn);
            classFileList.appendChild(fileItem);
        });
        
        // Enable/disable generate button based on whether files are selected or code is entered
        checkGenerateButtonState();
    }
    
    // Monitor textarea input
    javaCodeTextarea.addEventListener('input', function() {
        // If user types in textarea, clear any selected files
        if (this.value.trim() !== '') {
            selectedFiles = [];
            updateFileList();
        }
        
        // Enable/disable generate button
        checkGenerateButtonState();
    });
    
    // Check if generate button should be enabled
    function checkGenerateButtonState() {
        if (selectedFiles.length > 0 || javaCodeTextarea.value.trim() !== '') {
            classGenerateBtn.disabled = false;
        } else {
            classGenerateBtn.disabled = true;
        }
    }
    
    // Generate class diagram
    classGenerateBtn.addEventListener('click', function() {
        classDiagramOutput.innerHTML = '';
        classDiagramOutput.classList.add('loading');
        
        // Get the input code or files
        const code = javaCodeTextarea.value.trim();
        
        // Process based on input type
        setTimeout(() => {
            classDiagramOutput.classList.remove('loading');
            
            try {
                if (classDiagramGenerator) {
                    if (code) {
                        classDiagramGenerator.parseCode(code);
                    } else if (selectedFiles.length > 0) {
                        classDiagramGenerator.parseFiles(selectedFiles);
                    }
                    classDiagramGenerator.generateDiagram();
                    classDiagramGenerator.renderDiagram(classDiagramOutput);
                } else {
                    throw new Error('Class diagram generator not initialized');
                }
                
                classDownloadBtn.disabled = false;
            } catch (error) {
                console.error('Error generating class diagram:', error);
                classDiagramOutput.innerHTML = `
                    <div style="text-align: center; color: var(--danger-color);">
                        <i class="fas fa-exclamation-triangle" style="font-size: 3rem; margin-bottom: 1rem;"></i>
                        <p>Error generating diagram: ${error.message}</p>
                    </div>
                `;
            }
        }, 1500);
    });
    
    // Download class diagram button
    classDownloadBtn.addEventListener('click', function() {
        if (classDiagramGenerator) {
            classDiagramGenerator.exportAsPNG()
                .then(result => {
                    if (result.success) {
                        console.log('Class diagram download: ' + result.message);
                    } else {
                        alert('Error: ' + result.message);
                    }
                })
                .catch(error => {
                    console.error('Export error:', error);
                    alert('Error exporting diagram: ' + error.message);
                });
        } else {
            alert('Diagram generator not initialized');
        }
    });
    
    // Allow drag and drop file upload
    const body = document.body;
    
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        body.addEventListener(eventName, preventDefaults, false);
    });
    
    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    ['dragenter', 'dragover'].forEach(eventName => {
        body.addEventListener(eventName, highlight, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        body.addEventListener(eventName, unhighlight, false);
    });
    
    function highlight() {
        body.classList.add('highlight');
    }
    
    function unhighlight() {
        body.classList.remove('highlight');
    }
    
    body.addEventListener('drop', handleDrop, false);
    
    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = Array.from(dt.files).filter(file => file.name.endsWith('.java'));
        
        if (files.length > 0) {
            classFileUpload.files = dt.files;
            selectedFiles = [...selectedFiles, ...files];
            updateFileList();
            javaCodeTextarea.value = '';
        }
    }
});