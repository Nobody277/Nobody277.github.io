document.addEventListener('DOMContentLoaded', function() {
    // Initialize Mermaid
    mermaid.initialize({
        startOnLoad: true,
        theme: 'default',
        securityLevel: 'loose',
        flowchart: {
            useMaxWidth: true,
            htmlLabels: true,
            curve: 'basis'
        }
    });

    // DOM Elements
    const tabButtons = document.querySelectorAll('.tab-btn');
    const inputRadios = document.querySelectorAll('input[name="input-method"]');
    const pasteContainer = document.getElementById('paste-container');
    const uploadContainer = document.getElementById('upload-container');
    const codeEditorContainer = document.getElementById('code-editor-container');
    const fileUpload = document.getElementById('file-upload');
    const generateBtn = document.getElementById('generate-btn');
    const diagramOutput = document.getElementById('diagram-output');
    const downloadSvgBtn = document.getElementById('download-svg-btn');
    const downloadPngBtn = document.getElementById('download-png-btn');
    
    // Initialize CodeMirror
    let codeEditor;

    // Current state
    let currentTab = 'class-diagram';

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

    fileUpload.addEventListener('change', function(event) {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                codeEditor.setValue(e.target.result);
                // Set focus back to the editor
                codeEditor.focus();
            };
            reader.readAsText(file);
        }
    });

    generateBtn.addEventListener('click', generateDiagram);
    downloadSvgBtn.addEventListener('click', () => downloadDiagram('svg'));
    downloadPngBtn.addEventListener('click', () => downloadDiagram('png'));

    // Functions
    function generateDiagram() {
        const javaCode = codeEditor.getValue().trim();
        
        if (!javaCode) {
            alert('Please enter Java code or upload a file.');
            return;
        }

        try {
            let mermaidCode;
            
            if (currentTab === 'class-diagram') {
                mermaidCode = generateClassDiagram(javaCode);
            } else {
                mermaidCode = generateFlowchart(javaCode);
            }

            diagramOutput.innerHTML = `<div class="mermaid">${mermaidCode}</div>`;
            
            // Initialize Mermaid with error handling
            try {
                mermaid.init(undefined, document.querySelectorAll('.mermaid'));
                
                // Only enable download buttons if diagram was successfully generated
                if (diagramOutput.querySelector('svg')) {
                    if (downloadSvgBtn) downloadSvgBtn.disabled = false;
                    if (downloadPngBtn) downloadPngBtn.disabled = false;
                } else {
                    throw new Error("SVG diagram was not created");
                }
            } catch (mermaidError) {
                handleError("Mermaid diagram generation failed", mermaidError);
            }
        } catch (error) {
            diagramOutput.innerHTML = `<div class="error">Error generating diagram: ${error.message}</div>`;
            downloadSvgBtn.disabled = true;
            downloadPngBtn.disabled = true;
        }
    }

    function generateClassDiagram(javaCode) {
        const classRegex = /class\s+(\w+)(?:\s+extends\s+(\w+))?(?:\s+implements\s+([\w,\s]+))?/g;
        const fieldRegex = /(private|public|protected)\s+(?:final\s+)?(\w+(?:<[\w<>,\s]+>)?)\s+(\w+)(?:\s*=\s*[^;]+)?;/g;
        const methodRegex = /(private|public|protected)\s+(?:static\s+)?(\w+(?:<[\w<>,\s]+>)?)\s+(\w+)\s*\(([^)]*)\)/g;

        let classMatch;
        let classes = [];
        let relationships = [];

        while ((classMatch = classRegex.exec(javaCode)) !== null) {
            const className = classMatch[1];
            const parentClass = classMatch[2];
            const interfaces = classMatch[3];
            
            // Track class for diagram
            classes.push(className);
            
            // Track inheritance relationship
            if (parentClass) {
                relationships.push(`${className} --|> ${parentClass} : extends`);
            }
            
            // Track interface implementations
            if (interfaces) {
                const interfaceList = interfaces.split(',').map(i => i.trim());
                interfaceList.forEach(intf => {
                    relationships.push(`${className} ..|> ${intf} : implements`);
                });
            }
        }

        // Build the class diagram in Mermaid syntax
        let mermaidCode = 'classDiagram\n';

        // Add classes with fields and methods
        for (const className of classes) {
            mermaidCode += `    class ${className} {\n`;
            
            // Reset regex lastIndex
            fieldRegex.lastIndex = 0;
            methodRegex.lastIndex = 0;
            
            let fieldMatch;
            while ((fieldMatch = fieldRegex.exec(javaCode)) !== null) {
                const visibility = fieldMatch[1] === 'private' ? '-' : (fieldMatch[1] === 'protected' ? '#' : '+');
                const type = fieldMatch[2];
                const name = fieldMatch[3];
                mermaidCode += `        ${visibility} ${name} : ${type}\n`;
            }
            
            let methodMatch;
            while ((methodMatch = methodRegex.exec(javaCode)) !== null) {
                const visibility = methodMatch[1] === 'private' ? '-' : (methodMatch[1] === 'protected' ? '#' : '+');
                const returnType = methodMatch[2];
                const name = methodMatch[3];
                const params = methodMatch[4];
                mermaidCode += `        ${visibility} ${name}(${params}) : ${returnType}\n`;
            }
            
            mermaidCode += '    }\n';
        }

        // Add relationships
        relationships.forEach(rel => {
            mermaidCode += `    ${rel}\n`;
        });

        return mermaidCode;
    }

    function generateFlowchart(javaCode) {
        // Find method bodies to analyze
        const methodBodyRegex = /(?:public|private|protected)(?:\s+static)?\s+(\w+)\s+(\w+)\s*\(([^)]*)\)\s*{([^}]*(?:{[^}]*})*[^}]*)}/gs;
        let methodMatch;
        let mermaidCode = 'flowchart TD\n';
        let idCounter = 1;
        
        while ((methodMatch = methodBodyRegex.exec(javaCode)) !== null) {
            const returnType = methodMatch[1];
            const methodName = methodMatch[2];
            const params = methodMatch[3];
            const body = methodMatch[4];
            
            // Add method start
            mermaidCode += `    start_${methodName}[Start ${methodName}] --> process_${methodName}_1[Method ${methodName}]\n`;
            let lastNodeId = `process_${methodName}_1`;
            
            // Parse the method body - improved to handle nested structures
            const parsedNodes = parseMethodBody(body, methodName, idCounter);
            if (parsedNodes.flowchart && parsedNodes.flowchart.length > 0) {
                mermaidCode += parsedNodes.flowchart.join('\n') + '\n';
                lastNodeId = parsedNodes.lastNodeId;
            }
            
            // Add method end if not already added
            mermaidCode += `    ${lastNodeId} --> end_${methodName}[End ${methodName}]\n`;
            
            idCounter = parsedNodes.idCounter;
        }
        
        return mermaidCode;
    }
    
    function parseMethodBody(body, methodName, startIdCounter) {
        let idCounter = startIdCounter;
        const flowchartLines = [];
        let lastNodeId = `process_${methodName}_1`;
        
        // Handle System.out.println statements
        const printRegex = /System\.out\.println\(([^)]+)\)/g;
        let printMatch;
        while ((printMatch = printRegex.exec(body)) !== null) {
            const printContent = printMatch[1].replace(/"/g, "'");
            const nodeId = `print_${methodName}_${idCounter}`;
            flowchartLines.push(`    ${lastNodeId} --> ${nodeId}[Print: ${printContent}]`);
            lastNodeId = nodeId;
            idCounter++;
        }
        
        // Handle for loops (including nested loops)
        const forLoopRegex = /for\s*\(([^;]+);([^;]+);([^)]+)\)\s*{([^}]*(?:{[^}]*})*[^}]*)}/gs;
        let forMatch;
        let loopDepth = 0;
        
        while ((forMatch = forLoopRegex.exec(body)) !== null) {
            loopDepth++;
            const initialization = forMatch[1].trim();
            const condition = forMatch[2].trim();
            const increment = forMatch[3].trim();
            const loopBody = forMatch[4];
            
            // Create loop start node
            const loopStartId = `loop_start_${methodName}_${idCounter}`;
            flowchartLines.push(`    ${lastNodeId} --> ${loopStartId}[Init: ${initialization}]`);
            idCounter++;
            
            // Create condition node
            const conditionId = `loop_cond_${methodName}_${idCounter}`;
            flowchartLines.push(`    ${loopStartId} --> ${conditionId}{${condition}?}`);
            idCounter++;
            
            // Create loop body
            const loopBodyId = `loop_body_${methodName}_${idCounter}`;
            flowchartLines.push(`    ${conditionId} -->|True| ${loopBodyId}[Loop Body]`);
            idCounter++;
            
            // Parse nested loop body
            const nestedResult = parseMethodBody(loopBody, `${methodName}_L${loopDepth}`, idCounter);
            if (nestedResult.flowchart && nestedResult.flowchart.length > 0) {
                flowchartLines.push(...nestedResult.flowchart);
                idCounter = nestedResult.idCounter;
            }
            
            // Create increment node
            const incrementId = `loop_incr_${methodName}_${idCounter}`;
            flowchartLines.push(`    ${nestedResult.lastNodeId || loopBodyId} --> ${incrementId}[${increment}]`);
            idCounter++;
            
            // Loop back to condition
            flowchartLines.push(`    ${incrementId} --> ${conditionId}`);
            
            // Exit loop
            const loopExitId = `loop_exit_${methodName}_${idCounter}`;
            flowchartLines.push(`    ${conditionId} -->|False| ${loopExitId}[Continue after loop]`);
            lastNodeId = loopExitId;
            idCounter++;
        }
        
        // Handle if statements
        const ifRegex = /if\s*\(([^)]+)\)\s*{([^}]*)}(?:\s*else\s*{([^}]*)})?/gs;
        let ifMatch;
        
        while ((ifMatch = ifRegex.exec(body)) !== null) {
            const condition = ifMatch[1].replace(/&&/g, 'AND').replace(/\|\|/g, 'OR');
            const ifBlock = ifMatch[2];
            const elseBlock = ifMatch[3];
            
            // Create condition node
            const conditionId = `if_cond_${methodName}_${idCounter}`;
            flowchartLines.push(`    ${lastNodeId} --> ${conditionId}{${condition}?}`);
            idCounter++;
            
            // Create if block
            const ifBlockId = `if_block_${methodName}_${idCounter}`;
            flowchartLines.push(`    ${conditionId} -->|True| ${ifBlockId}[If Block]`);
            idCounter++;
            
            // Parse if block body
            const ifBlockResult = parseMethodBody(ifBlock, `${methodName}_IF`, idCounter);
            if (ifBlockResult.flowchart && ifBlockResult.flowchart.length > 0) {
                flowchartLines.push(...ifBlockResult.flowchart);
                idCounter = ifBlockResult.idCounter;
            }
            
            let ifEndNodeId = ifBlockResult.lastNodeId || ifBlockId;
            
            if (elseBlock) {
                // Create else block
                const elseBlockId = `else_block_${methodName}_${idCounter}`;
                flowchartLines.push(`    ${conditionId} -->|False| ${elseBlockId}[Else Block]`);
                idCounter++;
                
                // Parse else block body
                const elseBlockResult = parseMethodBody(elseBlock, `${methodName}_ELSE`, idCounter);
                if (elseBlockResult.flowchart && elseBlockResult.flowchart.length > 0) {
                    flowchartLines.push(...elseBlockResult.flowchart);
                    idCounter = elseBlockResult.idCounter;
                }
                
                // Join paths
                const joinId = `join_${methodName}_${idCounter}`;
                flowchartLines.push(`    ${ifEndNodeId} --> ${joinId}[Join]`);
                flowchartLines.push(`    ${elseBlockResult.lastNodeId || elseBlockId} --> ${joinId}`);
                lastNodeId = joinId;
                idCounter++;
            } else {
                // If there's no else block, create a direct path
                const afterIfId = `after_if_${methodName}_${idCounter}`;
                flowchartLines.push(`    ${conditionId} -->|False| ${afterIfId}[Skip If]`);
                flowchartLines.push(`    ${ifEndNodeId} --> ${afterIfId}`);
                lastNodeId = afterIfId;
                idCounter++;
            }
        }
        
        return {
            flowchart: flowchartLines,
            lastNodeId,
            idCounter
        };
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
                context.fillStyle = 'white';
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

    // Initialize UI elements
    function initializeUI() {
        // Initialize CodeMirror
        codeEditor = CodeMirror(codeEditorContainer, {
            mode: "text/x-java",
            theme: "dracula",
            lineNumbers: true,
            matchBrackets: true,
            indentUnit: 4,
            smartIndent: true,
            indentWithTabs: true,
            extraKeys: {
                "Tab": function(cm) {
                    if (cm.somethingSelected()) {
                        cm.indentSelection("add");
                    } else {
                        cm.replaceSelection("    ", "end", "+input");
                    }
                }
            },
            autoCloseBrackets: true,
            autoRefresh: true
        });

        // Add initial example code to help users get started
        codeEditor.setValue(`public class Main {
    public static void main(String[] args) {
        for (int i = 1; i <= 3; i++) {
            for (int j = 1; j <= 3; j++) {
                System.out.println("i: " + i + ", j: " + j);
            }
        }
    }
}`);
        
        // Make sure download buttons are disabled initially
        if (downloadSvgBtn) downloadSvgBtn.disabled = true;
        if (downloadPngBtn) downloadPngBtn.disabled = true;
    }

    // Error handling function
    function handleError(message, error) {
        console.error(message, error);
        diagramOutput.innerHTML = `<div class="error-message">${message}: ${error.message}</div>`;
        
        // Safely disable buttons
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
