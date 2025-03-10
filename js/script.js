// Load additional script files
function loadScript(url) {
    return new Promise((resolve, reject) => {
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
    // Elements
    const tabBtns = document.querySelectorAll('.tab-btn');
    const generateBtn = document.getElementById('generate-btn');
    const uploadBtn = document.getElementById('upload-btn');
    const fileUpload = document.getElementById('file-upload');
    const fileList = document.getElementById('file-list');
    const downloadBtn = document.getElementById('download-png-btn');
    const javaCodeTextarea = document.getElementById('java-code');
    const diagramOutput = document.getElementById('diagram-output');
    
    // Initialize diagram generators
    let classDiagramGenerator;
    let flowchartGenerator;
    
    // Initialize after a short delay to ensure scripts are loaded
    setTimeout(() => {
        try {
            classDiagramGenerator = new ClassDiagramGenerator();
            flowchartGenerator = new FlowchartGenerator();
            console.log('Diagram generators initialized successfully');
        } catch (error) {
            console.error('Error initializing diagram generators:', error);
        }
    }, 500);
    
    // Initialize variables to track state
    let selectedFiles = [];
    let currentTab = 'class-diagram';
    
    // Tab switching
    tabBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            // Remove active class from all tabs
            tabBtns.forEach(tab => tab.classList.remove('active'));
            tabBtns.forEach(tab => tab.setAttribute('aria-selected', 'false'));
            
            // Add active class to clicked tab
            this.classList.add('active');
            this.setAttribute('aria-selected', 'true');
            
            // Store the current tab
            currentTab = this.dataset.tab;
        });
    });
    
    // Trigger file upload when the upload button is clicked
    uploadBtn.addEventListener('click', function() {
        fileUpload.click();
    });
    
    // Handle file selection
    fileUpload.addEventListener('change', function(e) {
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
        fileList.innerHTML = '';
        
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
            fileList.appendChild(fileItem);
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
            generateBtn.disabled = false;
        } else {
            generateBtn.disabled = true;
        }
    }
    
    // Generate diagram
    generateBtn.addEventListener('click', function() {
        diagramOutput.innerHTML = '';
        diagramOutput.classList.add('loading');
        
        // Get the input code or files
        const code = javaCodeTextarea.value.trim();
        
        // Process based on current tab and input type
        setTimeout(() => {
            diagramOutput.classList.remove('loading');
            
            try {
                if (currentTab === 'class-diagram') {
                    if (classDiagramGenerator) {
                        if (code) {
                            classDiagramGenerator.parseCode(code);
                        } else if (selectedFiles.length > 0) {
                            classDiagramGenerator.parseFiles(selectedFiles);
                        }
                        classDiagramGenerator.generateDiagram();
                        classDiagramGenerator.renderDiagram(diagramOutput);
                    } else {
                        throw new Error('Class diagram generator not initialized');
                    }
                } else {
                    if (flowchartGenerator) {
                        if (code) {
                            flowchartGenerator.parseCode(code);
                        } else if (selectedFiles.length > 0) {
                            flowchartGenerator.parseFiles(selectedFiles);
                        }
                        flowchartGenerator.generateFlowchart();
                        flowchartGenerator.renderFlowchart(diagramOutput);
                    } else {
                        throw new Error('Flowchart generator not initialized');
                    }
                }
                
                downloadBtn.disabled = false;
            } catch (error) {
                console.error('Error generating diagram:', error);
                diagramOutput.innerHTML = `
                    <div style="text-align: center; color: var(--danger-color);">
                        <i class="fas fa-exclamation-triangle" style="font-size: 3rem; margin-bottom: 1rem;"></i>
                        <p>Error generating diagram: ${error.message}</p>
                    </div>
                `;
            }
        }, 1500);
    });
    
    // Download button
    downloadBtn.addEventListener('click', function() {
        if (currentTab === 'class-diagram' && classDiagramGenerator) {
            classDiagramGenerator.exportAsPNG()
                .then(result => {
                    if (result.success) {
                        // This would be replaced with actual download code
                        alert('Class diagram download: ' + result.message);
                    } else {
                        alert('Error: ' + result.message);
                    }
                })
                .catch(error => {
                    console.error('Export error:', error);
                    alert('Error exporting diagram: ' + error.message);
                });
        } else if (currentTab === 'flowchart' && flowchartGenerator) {
            flowchartGenerator.exportAsPNG()
                .then(result => {
                    if (result.success) {
                        // This would be replaced with actual download code
                        alert('Flowchart download: ' + result.message);
                    } else {
                        alert('Error: ' + result.message);
                    }
                })
                .catch(error => {
                    console.error('Export error:', error);
                    alert('Error exporting flowchart: ' + error.message);
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
            fileUpload.files = dt.files;
            selectedFiles = [...selectedFiles, ...files];
            updateFileList();
            javaCodeTextarea.value = '';
        }
    }
});