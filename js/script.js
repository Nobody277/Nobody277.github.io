// Initialize Mermaid.js with configuration
mermaid.initialize({
    startOnLoad: true,
    theme: 'default',
    securityLevel: 'loose',
    flowchart: {
        useMaxWidth: false,
        htmlLabels: true,
        curve: 'basis'
    },
    classeDiagram: {
        useMaxWidth: false
    }
});

// DOM elements
const javaCodeTextarea = document.getElementById('java-code');
const generateBtn = document.getElementById('generate-btn');
const uploadGenerateBtn = document.getElementById('upload-generate-btn');
const fileInput = document.getElementById('file-input');
const classDiagramOutput = document.getElementById('class-diagram-output');
const flowchartOutput = document.getElementById('flowchart-output');
const downloadClassBtn = document.getElementById('download-class-btn');
const downloadFlowBtn = document.getElementById('download-flow-btn');

// Tab navigation
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');
const vizTabBtns = document.querySelectorAll('.viz-tab-btn');
const vizTabContents = document.querySelectorAll('.viz-tab-content');
const exampleBtns = document.querySelectorAll('.example-btn');

// Example code
const examples = {
    student: `public class Student {
    private String name;
    private String course;
    private int numericalScore;
    private char grade;
    
    public Student() {
        name = "Unknown";
        course = "CS101";
        numericalScore = 0;
        grade = 'F';
    }
    
    public Student(String name, String course, int score) {
        this.name = name;
        this.course = course;
        this.numericalScore = score;
        calculateGrade();
    }
    
    private void calculateGrade() {
        if (numericalScore >= 90) {
            grade = 'A';
        } else if (numericalScore >= 80) {
            grade = 'B';
        } else if (numericalScore >= 70) {
            grade = 'C';
        } else if (numericalScore >= 60) {
            grade = 'D';
        } else {
            grade = 'F';
        }
    }
    
    public void printGrade() {
        System.out.println(name + "'s grade in " + course + ": " + grade + " (" + numericalScore + ")");
    }
    
    // Getters and setters
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    
    public String getCourse() { return course; }
    public void setCourse(String course) { this.course = course; }
    
    public int getNumericalScore() { return numericalScore; }
    public void setNumericalScore(int score) {
        this.numericalScore = score;
        calculateGrade();
    }
    
    public char getGrade() { return grade; }
}`,
    loops: `public class NestedLoopExample {
    public static void main(String[] args) {
        // Print a pattern using nested loops
        for (int i = 1; i <= 5; i++) {
            for (int j = 1; j <= i; j++) {
                System.out.print("* ");
            }
            System.out.println();
        }
        
        // Calculate multiplication table
        System.out.println("\\nMultiplication Table:");
        for (int i = 1; i <= 3; i++) {
            for (int j = 1; j <= 3; j++) {
                System.out.print(i + "x" + j + "=" + (i*j) + "\\t");
            }
            System.out.println();
        }
    }
}`,
    calculator: `import java.util.Scanner;

public class Calculator {
    private double result;
    
    public Calculator() {
        result = 0;
    }
    
    public void add(double number) {
        result += number;
    }
    
    public void subtract(double number) {
        result -= number;
    }
    
    public void multiply(double number) {
        result *= number;
    }
    
    public void divide(double number) {
        if (number != 0) {
            result /= number;
        } else {
            System.out.println("Error: Division by zero");
        }
    }
    
    public double getResult() {
        return result;
    }
    
    public void clear() {
        result = 0;
    }
    
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        Calculator calc = new Calculator();
        boolean running = true;
        
        System.out.println("Simple Calculator");
        
        while (running) {
            System.out.println("\\nCurrent result: " + calc.getResult());
            System.out.println("1. Add");
            System.out.println("2. Subtract");
            System.out.println("3. Multiply");
            System.out.println("4. Divide");
            System.out.println("5. Clear");
            System.out.println("6. Exit");
            System.out.print("Choose an operation (1-6): ");
            
            int choice = scanner.nextInt();
            
            if (choice >= 1 && choice <= 4) {
                System.out.print("Enter number: ");
                double number = scanner.nextDouble();
                
                switch (choice) {
                    case 1: calc.add(number); break;
                    case 2: calc.subtract(number); break;
                    case 3: calc.multiply(number); break;
                    case 4: calc.divide(number); break;
                }
            } else if (choice == 5) {
                calc.clear();
            } else if (choice == 6) {
                running = false;
                System.out.println("Calculator closed.");
            } else {
                System.out.println("Invalid choice. Please try again.");
            }
        }
        
        scanner.close();
    }
}`
};

// Tab navigation event listeners
tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        // Remove active class from all buttons and content
        tabBtns.forEach(b => b.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));
        
        // Add active class to clicked button
        btn.classList.add('active');
        
        // Show corresponding content
        const targetId = btn.getAttribute('data-target');
        document.getElementById(targetId).classList.add('active');
    });
});

vizTabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        // Remove active class from all buttons and content
        vizTabBtns.forEach(b => b.classList.remove('active'));
        vizTabContents.forEach(c => c.classList.remove('active'));
        
        // Add active class to clicked button
        btn.classList.add('active');
        
        // Show corresponding content
        const targetId = btn.getAttribute('data-target');
        document.getElementById(targetId).classList.add('active');
    });
});

// Example buttons
exampleBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const exampleKey = btn.getAttribute('data-example');
        javaCodeTextarea.value = examples[exampleKey];
        
        // Switch to paste code tab
        tabBtns[0].click();
    });
});

// File upload handling
fileInput.addEventListener('change', handleFileUpload);

function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        javaCodeTextarea.value = e.target.result;
        
        // Switch to paste code tab
        tabBtns[0].click();
    };
    reader.readAsText(file);
}

// Generate diagrams from code
generateBtn.addEventListener('click', () => generateDiagrams(javaCodeTextarea.value));
uploadGenerateBtn.addEventListener('click', () => generateDiagrams(javaCodeTextarea.value));

function generateDiagrams(code) {
    if (!code.trim()) {
        alert('Please enter or upload Java code first.');
        return;
    }
    
    try {
        const classDiagram = generateClassDiagram(code);
        const flowchart = generateFlowchart(code);
        
        renderDiagrams(classDiagram, flowchart);
        enableDownloadButtons();
    } catch (error) {
        console.error('Error generating diagrams:', error);
        alert('Error generating diagrams. Please check the console for details.');
    }
}

function renderDiagrams(classDiagram, flowchart) {
    classDiagramOutput.innerHTML = classDiagram;
    flowchartOutput.innerHTML = flowchart;
    
    // Re-render mermaid diagrams
    mermaid.init(undefined, document.querySelectorAll('.mermaid'));
}

function enableDownloadButtons() {
    downloadClassBtn.disabled = false;
    downloadFlowBtn.disabled = false;
    
    downloadClassBtn.addEventListener('click', () => downloadSVG('class-diagram-output'));
    downloadFlowBtn.addEventListener('click', () => downloadSVG('flowchart-output'));
}

function downloadSVG(elementId) {
    // Get the SVG content
    const svgElement = document.querySelector(`#${elementId} svg`);
    if (!svgElement) {
        alert('No diagram to download.');
        return;
    }
    
    // Create a blob from the SVG content
    const svgData = new XMLSerializer().serializeToString(svgElement);
    const blob = new Blob([svgData], { type: 'image/svg+xml' });
    
    // Create a download link and trigger it
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${elementId}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Main Java parsing functions
function generateClassDiagram(code) {
    // Simple parser to extract class information
    const classInfo = parseJavaClass(code);
    
    if (!classInfo) {
        return `classDiagram
    class NoClassFound {
        +String message
        +getMessage() String
    }
    
    note for NoClassFound "No valid Java class found in the code."`;
    }
    
    // Generate Mermaid class diagram syntax
    let diagram = 'classDiagram\n';
    
    // Add the class and its properties
    diagram += `    class ${classInfo.name} {\n`;
    
    // Add fields
    classInfo.fields.forEach(field => {
        const visibility = field.visibility === 'private' ? '-' : '+';
        diagram += `        ${visibility}${field.type} ${field.name}\n`;
    });
    
    // Add methods
    classInfo.methods.forEach(method => {
        const visibility = method.visibility === 'private' ? '-' : '+';
        const returnType = method.returnType ? ` ${method.returnType}` : '';
        diagram += `        ${visibility}${method.name}(${method.parameters})${returnType}\n`;
    });
    
    diagram += '    }\n';
    
    // Add any inheritance or implementation relationships
    if (classInfo.extends) {
        diagram += `    ${classInfo.extends} <|-- ${classInfo.name}\n`;
    }
    
    if (classInfo.implements.length > 0) {
        classInfo.implements.forEach(impl => {
            diagram += `    ${impl} <|.. ${classInfo.name}\n`;
        });
    }
    
    return diagram;
}

function generateFlowchart(code) {
    // Parse method for flowchart (typically main method or a specific method)
    const methodInfo = parseJavaMethod(code);
    
    if (!methodInfo) {
        return `flowchart TD
    A[No Method Found] --> B[Please provide Java code with methods]
    
    style A fill:#f44336,color:#fff
    style B fill:#ff9800,color:#fff`;
    }
    
    // Generate Mermaid flowchart syntax
    let flowchart = 'flowchart TD\n';
    
    // Start node
    flowchart += `    start[${methodInfo.name}] --> process1\n`;
    flowchart += '    style start fill:#4CAF50,color:#fff\n';
    
    // Process simple statements, if-else, loops, etc.
    let stmtIndex = 1;
    
    methodInfo.statements.forEach(stmt => {
        if (stmt.type === 'if') {
            // If statement
            flowchart += `    process${stmtIndex}[${escapeHtml(stmt.condition)}] --> condition${stmtIndex}{${escapeHtml(stmt.condition)}?}\n`;
            flowchart += `    condition${stmtIndex} -->|True| trueProcess${stmtIndex}[${escapeHtml(stmt.trueBlock)}]\n`;
            
            if (stmt.falseBlock) {
                flowchart += `    condition${stmtIndex} -->|False| falseProcess${stmtIndex}[${escapeHtml(stmt.falseBlock)}]\n`;
                flowchart += `    falseProcess${stmtIndex} --> process${stmtIndex + 1}\n`;
            } else {
                flowchart += `    condition${stmtIndex} -->|False| process${stmtIndex + 1}\n`;
            }
            
            flowchart += `    trueProcess${stmtIndex} --> process${stmtIndex + 1}\n`;
        } else if (stmt.type === 'for' || stmt.type === 'while') {
            // Loop statement
            flowchart += `    process${stmtIndex}[${escapeHtml(stmt.init)}] --> loopCondition${stmtIndex}{${escapeHtml(stmt.condition)}?}\n`;
            flowchart += `    loopCondition${stmtIndex} -->|True| loopBody${stmtIndex}[${escapeHtml(stmt.body)}]\n`;
            flowchart += `    loopBody${stmtIndex} --> loopUpdate${stmtIndex}[${escapeHtml(stmt.update)}]\n`;
            flowchart += `    loopUpdate${stmtIndex} --> loopCondition${stmtIndex}\n`;
            flowchart += `    loopCondition${stmtIndex} -->|False| process${stmtIndex + 1}\n`;
        } else {
            // Simple statement
            if (stmtIndex < methodInfo.statements.length) {
                flowchart += `    process${stmtIndex}[${escapeHtml(stmt.code)}] --> process${stmtIndex + 1}\n`;
            } else {
                flowchart += `    process${stmtIndex}[${escapeHtml(stmt.code)}] --> end\n`;
            }
        }
        
        stmtIndex++;
    });
    
    // End node if not linked yet
    if (methodInfo.statements.length === 0) {
        flowchart += '    start --> end\n';
    }
    flowchart += '    end[End]\n';
    flowchart += '    style end fill:#f44336,color:#fff\n';
    
    return flowchart;
}

// Java parsing helper functions
function parseJavaClass(code) {
    // Very basic class parsing - in a real app, use a proper Java parser
    const classRegex = /\s*(?:public|private|protected)?\s*(?:abstract|final)?\s*class\s+(\w+)(?:\s+extends\s+(\w+))?(?:\s+implements\s+([\w,\s]+))?\s*\{/;
    const fieldRegex = /\s*(?:(public|private|protected)\s+)?(?:static\s+|final\s+)*(\w+(?:<[\w<>]+>)?)\s+(\w+)\s*(?:=\s*[^;]+)?;/g;
    const methodRegex = /\s*(?:(public|private|protected)\s+)?(?:static\s+|final\s+)*(?:(\w+(?:<[\w<>]+>)?)\s+)?(\w+)\s*\(([\w\s,<>[\]]*)\)\s*(?:throws\s+[\w,\s]+)?\s*\{/g;
    
    const classMatch = code.match(classRegex);
    if (!classMatch) return null;
    
    const className = classMatch[1];
    const extendsClass = classMatch[2] || null;
    const implementsInterfaces = classMatch[3] ? classMatch[3].split(',').map(i => i.trim()) : [];
    
    const fields = [];
    let fieldMatch;
    while ((fieldMatch = fieldRegex.exec(code)) !== null) {
        fields.push({
            visibility: fieldMatch[1] || 'default',
            type: fieldMatch[2],
            name: fieldMatch[3]
        });
    }
    
    const methods = [];
    let methodMatch;
    while ((methodMatch = methodRegex.exec(code)) !== null) {
        methods.push({
            visibility: methodMatch[1] || 'default',
            returnType: methodMatch[2] || 'void',
            name: methodMatch[3],
            parameters: methodMatch[4] || ''
        });
    }
    
    return {
        name: className,
        extends: extendsClass,
        implements: implementsInterfaces,
        fields,
        methods
    };
}

function parseJavaMethod(code) {
    // Focus on main method or first method found
    const methodRegex = /\s*(?:public|private|protected)?\s*(?:static\s+)?(?:final\s+)?(?:(\w+(?:<[\w<>]+>)?)\s+)?(\w+)\s*\(([\w\s,<>[\]]*)\)\s*(?:throws\s+[\w,\s]+)?\s*\{([^}]*)\}/g;
    
    let methodMatch;
    while ((methodMatch = methodRegex.exec(code)) !== null) {
        const methodName = methodMatch[2];
        const methodBody = methodMatch[4];
        
        // Simple statement parsing - in a real app, use AST
        const statements = [];
        
        // Look for if statements
        const ifRegex = /if\s*\((.*?)\)\s*\{([^}]*)\}(?:\s*else\s*\{([^}]*)\})?/g;
        let ifMatch;
        while ((ifMatch = ifRegex.exec(methodBody)) !== null) {
            statements.push({
                type: 'if',
                condition: ifMatch[1].trim(),
                trueBlock: ifMatch[2].trim(),
                falseBlock: ifMatch[3] ? ifMatch[3].trim() : null
            });
        }
        
        // Look for for loops
        const forRegex = /for\s*\((.*?);\s*(.*?);\s*(.*?)\)\s*\{([^}]*)\}/g;
        let forMatch;
        while ((forMatch = forRegex.exec(methodBody)) !== null) {
            statements.push({
                type: 'for',
                init: forMatch[1].trim(),
                condition: forMatch[2].trim(),
                update: forMatch[3].trim(),
                body: forMatch[4].trim()
            });
        }
        
        // Look for while loops
        const whileRegex = /while\s*\((.*?)\)\s*\{([^}]*)\}/g;
        let whileMatch;
        while ((whileMatch = whileRegex.exec(methodBody)) !== null) {
            statements.push({
                type: 'while',
                condition: whileMatch[1].trim(),
                body: whileMatch[2].trim(),
                init: '',
                update: ''
            });
        }
        
        // Look for other statements (simplified)
        const stmtRegex = /([^;{]+);/g;
        let stmtMatch;
        while ((stmtMatch = stmtRegex.exec(methodBody)) !== null) {
            const stmt = stmtMatch[1].trim();
            if (stmt && !stmt.includes('if') && !stmt.includes('for') && !stmt.includes('while')) {
                statements.push({
                    type: 'statement',
                    code: stmt
                });
            }
        }
        
        return {
            name: methodName,
            statements
        };
    }
    
    return null;
}

// Helper function to escape HTML in flowchart labels
function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
        .replace(/\n/g, ' ');
}

// Initialize the page
document.addEventListener('DOMContentLoaded', function() {
    // Initialize with the default example in textarea
    javaCodeTextarea.value = examples.student;
    
    // Initialize drag and drop for file upload
    const dropZone = document.querySelector('.file-upload');
    
    dropZone.addEventListener('dragover', function(e) {
        e.preventDefault();
        this.classList.add('file-upload-hover');
    });
    
    dropZone.addEventListener('dragleave', function() {
        this.classList.remove('file-upload-hover');
    });
    
    dropZone.addEventListener('drop', function(e) {
        e.preventDefault();
        this.classList.remove('file-upload-hover');
        
        if (e.dataTransfer.files.length) {
            fileInput.files = e.dataTransfer.files;
            handleFileUpload({ target: { files: e.dataTransfer.files } });
        }
    });
});
