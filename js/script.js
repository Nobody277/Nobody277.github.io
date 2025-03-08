document.addEventListener('DOMContentLoaded', function() {
    // Initialize Mermaid with compatible syntax settings
    mermaid.initialize({
        startOnLoad: false,
        theme: 'dark',
        securityLevel: 'loose',
        flowchart: {
            useMaxWidth: true,
            htmlLabels: true,
            curve: 'linear',
            diagramPadding: 8
        },
        themeVariables: {
            primaryColor: '#3949ab',
            primaryTextColor: '#fff',
            primaryBorderColor: '#3949ab',
            lineColor: '#ffffff',
            secondaryColor: '#d32f2f',
            tertiaryColor: '#2a2a2a'
        },
        // Disable automatic font re-sizing for better stability
        fontSize: 16
    });

    // DOM Elements
    const tabButtons = document.querySelectorAll('.tab-btn');
    const inputRadios = document.querySelectorAll('input[name="input-method"]');
    const pasteContainer = document.getElementById('paste-container');
    const uploadContainer = document.getElementById('upload-container');
    const javaCodeTextarea = document.getElementById('java-code');
    const fileUpload = document.getElementById('file-upload');
    const fileList = document.getElementById('file-list');
    const generateBtn = document.getElementById('generate-btn');
    const diagramOutput = document.getElementById('diagram-output');
    const downloadSvgBtn = document.getElementById('download-svg-btn');
    const downloadPngBtn = document.getElementById('download-png-btn');

    // Current state
    let currentTab = 'class-diagram';
    let uploadedFiles = [];

    // Event Listeners
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            currentTab = button.dataset.tab;
        });
    });

    inputRadios.forEach(radio => {
        radio.addEventListener('change', () => {
            if (radio.value === 'paste') {
                pasteContainer.style.display = 'block';
                uploadContainer.style.display = 'none';
            } else {
                pasteContainer.style.display = 'none';
                uploadContainer.style.display = 'block';
            }
        });
    });

    // Handle file uploads
    fileUpload.addEventListener('change', handleFileUpload);

    generateBtn.addEventListener('click', generateDiagram);
    
    if (downloadSvgBtn) {
        downloadSvgBtn.addEventListener('click', () => downloadDiagram('svg'));
    }
    
    if (downloadPngBtn) {
        downloadPngBtn.addEventListener('click', () => downloadDiagram('png'));
    }

    // File upload handler
    function handleFileUpload(event) {
        const files = event.target.files;
        
        if (files.length > 0) {
            Array.from(files).forEach(file => {
                if (file.name.endsWith('.java')) {
                    // Read file content
                    const reader = new FileReader();
                    reader.onload = function(e) {
                        const fileContent = e.target.result;
                        
                        // Add to uploadedFiles array
                        uploadedFiles.push({
                            name: file.name,
                            content: fileContent
                        });
                        
                        // Update file list UI
                        updateFileList();
                    };
                    reader.readAsText(file);
                }
            });
        }
    }

    // Update the file list display
    function updateFileList() {
        // Clear existing list
        fileList.innerHTML = '';
        
        // Add each file to the list
        uploadedFiles.forEach((file, index) => {
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item';
            
            const fileName = document.createElement('div');
            fileName.className = 'file-item-name';
            fileName.innerHTML = `<i class="fas fa-file-code"></i> ${file.name}`;
            
            const removeBtn = document.createElement('button');
            removeBtn.className = 'file-item-remove';
            removeBtn.innerHTML = '<i class="fas fa-times"></i>';
            removeBtn.addEventListener('click', () => {
                uploadedFiles.splice(index, 1);
                updateFileList();
            });
            
            fileItem.appendChild(fileName);
            fileItem.appendChild(removeBtn);
            fileList.appendChild(fileItem);
        });
    }

    // Functions
    function generateDiagram() {
        let javaCode = '';
        
        // Get code based on selected input method
        const isPasteMethod = document.querySelector('input[name="input-method"]:checked').value === 'paste';
        
        if (isPasteMethod) {
            javaCode = javaCodeTextarea.value.trim();
            
            if (!javaCode) {
                alert('Please enter Java code or upload a file.');
                return;
            }
        } else {
            if (uploadedFiles.length === 0) {
                alert('Please upload at least one Java file.');
                return;
            }
            
            // Concatenate all file contents (for flowcharts, we'll use the first file)
            if (currentTab === 'class-diagram') {
                // For class diagrams, we'll analyze all files together
                javaCode = uploadedFiles.map(file => file.content).join('\n\n');
            } else {
                // For flowcharts, just use the first file
                javaCode = uploadedFiles[0].content;
            }
        }

        try {
            let mermaidCode;
            
            if (currentTab === 'class-diagram') {
                mermaidCode = generateClassDiagram(javaCode);
            } else {
                mermaidCode = generateFlowchart(javaCode);
            }

            // Log the generated code for debugging
            console.log("Generated Mermaid code:", mermaidCode);
            
            // Clear previous content
            diagramOutput.innerHTML = '';
            
            // Create a new container for the diagram
            const diagramContainer = document.createElement('div');
            diagramContainer.className = 'mermaid';
            diagramContainer.textContent = mermaidCode;
            diagramOutput.appendChild(diagramContainer);
            
            // Initialize Mermaid with error handling
            try {
                // Use the render API instead of init for better error handling
                mermaid.render('mermaid-svg', mermaidCode)
                    .then(result => {
                        diagramOutput.innerHTML = result.svg;
                        
                        // Enable download buttons
                        if (downloadSvgBtn) downloadSvgBtn.disabled = false;
                        if (downloadPngBtn) downloadPngBtn.disabled = false;
                    })
                    .catch(error => {
                        console.error("Mermaid rendering error:", error);
                        handleError("Error rendering diagram", { message: "Syntax error in diagram. Please check console for details." });
                    });
            } catch (mermaidError) {
                console.error("Mermaid error:", mermaidError);
                handleError("Mermaid diagram generation failed", mermaidError);
            }
        } catch (error) {
            console.error("Generation error:", error);
            handleError("Error generating diagram", error);
        }
    }

    function generateClassDiagram(javaCode) {
        // Create a simple class diagram that works reliably with Mermaid 10.5.0
        let mermaidCode = 'classDiagram\n';
        
        // Extract class names
        const classRegex = /class\s+(\w+)(?:\s+extends\s+(\w+))?(?:\s+implements\s+([\w,\s]+))?/g;
        const classes = [];
        let classMatch;
        
        while ((classMatch = classRegex.exec(javaCode)) !== null) {
            const className = classMatch[1];
            classes.push({
                name: className,
                parent: classMatch[2] || null
            });
        }
        
        // Process each class
        for (const cls of classes) {
            // Extract variables for this class
            const classPattern = new RegExp(`class\\s+${cls.name}[^{]*{([^}]*)}`, 's');
            const classBody = classPattern.exec(javaCode);
            
            if (!classBody) continue;
            
            // Find variables
            const variableRegex = /(private|public|protected)?\s*(static)?\s*(\w+(?:<[\w<>,\s]+>)?)\s+(\w+)(?:\s*=\s*[^;]+)?;/g;
            const variables = [];
            let variableMatch;
            
            while ((variableMatch = variableRegex.exec(classBody[1])) !== null) {
                const accessMod = variableMatch[1] || '';
                const isStatic = variableMatch[2] ? true : false;
                const type = variableMatch[3];
                const name = variableMatch[4];
                
                variables.push({
                    accessMod,
                    isStatic,
                    type,
                    name
                });
            }
            
            // Find methods
            const methodRegex = /(private|public|protected)?\s*(static)?\s*(\w+(?:<[\w<>,\s]+>)?)\s+(\w+)\s*\(([^)]*)\)/g;
            const methods = [];
            let methodMatch;
            
            while ((methodMatch = methodRegex.exec(classBody[1])) !== null) {
                const accessMod = methodMatch[1] || '';
                const isStatic = methodMatch[2] ? true : false;
                const returnType = methodMatch[3];
                const name = methodMatch[4];
                const params = methodMatch[5];
                
                methods.push({
                    accessMod,
                    isStatic,
                    returnType,
                    name,
                    params
                });
            }
            
            // Add class with variables and methods
            mermaidCode += `    class ${cls.name} {\n`;
            
            // Add variables
            if (variables.length > 0) {
                for (const v of variables) {
                    const accessSymbol = v.accessMod === 'private' ? '-' : 
                                       v.accessMod === 'protected' ? '#' : '+';
                    mermaidCode += `        ${accessSymbol} ${v.name} : ${v.type}\n`;
                }
            }
            
            // Add methods
            if (methods.length > 0) {
                for (const m of methods) {
                    const accessSymbol = m.accessMod === 'private' ? '-' : 
                                       m.accessMod === 'protected' ? '#' : '+';
                    mermaidCode += `        ${accessSymbol} ${m.name}(${m.params}) : ${m.returnType}\n`;
                }
            }
            
            mermaidCode += '    }\n';
            
            // Add inheritance relationship
            if (cls.parent) {
                mermaidCode += `    ${cls.name} --|> ${cls.parent}\n`;
            }
        }
        
        // Add associations between classes
        for (let i = 0; i < classes.length; i++) {
            const className = classes[i].name;
            
            // Look for references to other classes
            for (let j = 0; j < classes.length; j++) {
                if (i === j) continue;
                
                const otherClass = classes[j].name;
                const classPattern = new RegExp(`class\\s+${className}[^{]*{([^}]*)}`, 's');
                const classBody = classPattern.exec(javaCode);
                
                if (classBody && (new RegExp(`\\b${otherClass}\\b`)).test(classBody[1])) {
                    mermaidCode += `    ${className} --> ${otherClass}\n`;
                }
            }
        }
        
        return mermaidCode;
    }

    function generateFlowchart(javaCode) {
        // Create a simple flowchart that works reliably with Mermaid 10.5.0
        let flowchart = 'flowchart TD\n';
        
        // Find class name
        const classMatch = javaCode.match(/class\s+(\w+)/);
        const className = classMatch ? classMatch[1] : "Unknown";
        
        // Add main class node
        flowchart += `    A[public class ${className}]\n`;
        
        // Find main method
        const mainMatch = javaCode.match(/public\s+static\s+void\s+main\s*\(\s*String\s*\[\]\s*\w+\s*\)\s*{([^}]*)}/s);
        
        if (mainMatch) {
            const mainBody = mainMatch[1];
            
            // Add main method node
            flowchart += `    A --> B[public static void main(String[] args)]\n`;
            
            // Look for for-loops
            const forLoopMatch = mainBody.match(/for\s*\(([^;]+);([^;]+);([^)]+)\)/);
            
            if (forLoopMatch) {
                const initExpr = forLoopMatch[1].trim();
                const condExpr = forLoopMatch[2].trim();
                
                // Add initialization
                flowchart += `    B --> C[${initExpr}]\n`;
                
                // Add condition check
                flowchart += `    C --> D{${condExpr}}\n`;
                
                // Add paths
                flowchart += `    D -->|True| E[Loop Body]\n`;
                flowchart += `    D -->|False| F[Exit Loop]\n`;
                
                // Add loop back
                flowchart += `    E --> G[Update]\n`;
                flowchart += `    G --> D\n`;
            }
        }
        
        // Style the nodes
        flowchart += `\n    classDef default fill:#3949ab,stroke:#3949ab,color:white\n`;
        flowchart += `    classDef condition fill:#d32f2f,stroke:#d32f2f,color:white\n`;
        flowchart += `    class D condition\n`;
        
        return flowchart;
    }

    function downloadDiagram(format) {
        const svgElement = diagramOutput.querySelector('svg');
        if (!svgElement) {
            alert('No diagram available to download. Please generate a diagram first.');
            return;
        }
        
        if (format === 'svg') {
            // SVG Download
            const svgData = new XMLSerializer().serializeToString(svgElement);
            const blob = new Blob([svgData], { type: 'image/svg+xml' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `${currentTab}-diagram.svg`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } else if (format === 'png') {
            // PNG Download
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            
            // Set canvas dimensions
            const svgWidth = svgElement.viewBox.baseVal.width || svgElement.width.baseVal.value;
            const svgHeight = svgElement.viewBox.baseVal.height || svgElement.height.baseVal.value;
            const scale = 2; // Scale for better quality
            
            canvas.width = svgWidth * scale;
            canvas.height = svgHeight * scale;
            context.scale(scale, scale);
            
            // Create image from SVG
            const img = new Image();
            const svgData = new XMLSerializer().serializeToString(svgElement);
            const svgBlob = new Blob([svgData], {type: 'image/svg+xml;charset=utf-8'});
            const url = URL.createObjectURL(svgBlob);
            
            img.onload = function() {
                // Draw image to canvas
                context.fillStyle = '#1e1e1e'; // Match background color
                context.fillRect(0, 0, canvas.width, canvas.height);
                context.drawImage(img, 0, 0, svgWidth, svgHeight);
                
                // Convert canvas to PNG and download
                try {
                    canvas.toBlob(function(blob) {
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `${currentTab}-diagram.png`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                    }, 'image/png');
                } catch (e) {
                    console.error('Error creating PNG:', e);
                    alert('Failed to create PNG. Try using SVG format instead.');
                }
            };
            
            img.onerror = function() {
                console.error('Error loading SVG');
                alert('Failed to create PNG. Try using SVG format instead.');
            };
            
            img.src = url;
        }
    }

    // Error handling function
    function handleError(message, error) {
        console.error(message, error);
        diagramOutput.innerHTML = `<div class="error-message">${message}: ${error.message}</div>`;
        
        // Safely disable buttons
        if (downloadSvgBtn) downloadSvgBtn.disabled = true;
        if (downloadPngBtn) downloadPngBtn.disabled = true;
    }

    // Initialize UI
    function initializeUI() {
        // Add initial example code to help users get started
        javaCodeTextarea.value = `public class Main {
    public static void main(String[] args) {
        // Create a new student
        Student student = new Student();
        student.name = "John Doe";
        student.course = "Computer Science";
        student.numericalScore = 85;
        student.printGrade();
    }
}

class Student {
    String name;
    String course;
    int numericalScore;
    char grade;
    
    public void printGrade() {
        if (numericalScore >= 80) {
            grade = 'A';
        } else if (numericalScore >= 70) {
            grade = 'B';
        } else if (numericalScore >= 60) {
            grade = 'C';
        } else {
            grade = 'F';
        }
        System.out.println(name + " got a " + grade + " in " + course);
    }
}`;
        
        // Make sure download buttons are disabled initially
        if (downloadSvgBtn) downloadSvgBtn.disabled = true;
        if (downloadPngBtn) downloadPngBtn.disabled = true;
    }

    // Initialize UI safely
    try {
        initializeUI();
    } catch (error) {
        handleError("Failed to initialize UI", error);
    }
});
