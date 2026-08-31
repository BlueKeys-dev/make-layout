export type DiagramType = 
  | 'mindmap' 
  | 'classDiagram' 
  | 'sequenceDiagram' 
  | 'flowchart' 
  | 'erDiagram' 
  | 'pie' 
  | 'requirementDiagram'
  | 'auto';

export interface DiagramConfig {
  id: DiagramType;
  label: string;
  icon: string; // Lucide icon name
  description: string;
  defaultCode: string;
  systemPrompt: string;
}

export const DIAGRAM_CONFIGS: Record<Exclude<DiagramType, 'auto'>, DiagramConfig> = {
  mindmap: {
    id: 'mindmap',
    label: 'Mind Map',
    icon: 'BrainCircuit',
    description: 'Visualize concepts and relationships hierarchically',
    defaultCode: 'mindmap\n  root((Central Idea))\n    Topic 1\n    Topic 2',
    systemPrompt: `Create an engaging and informative mind map for:
    Requirements:
    1. Use VALID Mermaid.js mindmap syntax ONLY.
    2. Start with: mindmap, flowchart 
    3. Root node uses double parentheses: root((Topic Name))
    4. Child nodes are plain text with proper indentation (2 spaces per level).
    5. Make content dense with 3-5 main branches and 2-3 sub-levels.
    6. Keep text SHORT - max 4-5 words per node.
    7. RETURN ONLY THE RAW MERMAID CODE. No markdown, no backticks, no explanations.
    
    VALID Example:
    mindmap
      root((Machine Learning))
        Supervised
          Classification
          Regression
        Unsupervised
          Clustering
          Dimensionality
        Reinforcement
          Q-Learning
          Policy Gradient
  `},
  flowchart: {
    id: 'flowchart',
    label: 'Flowchart',
    icon: 'Workflow',
    description: 'Process flows, algorithms, and decision trees',
    defaultCode: 'flowchart TD\n  A[Start] --> B{Is it working?}\n  B -->|Yes| C[Great!]\n  B -->|No| D[Debug]',
    systemPrompt: `Create a clear and logical flowchart.
    Requirements:
    1. Use VALID Mermaid.js flowchart syntax (graph TD or flowchart TD).
    2. Use varied node shapes: [] for process, {} for decision, () for start/end, [[]] for subroutines.
    3. Use meaningful labels on links (-->|Label|).
    4. Structure the flow logically from top to bottom.
    5. Style the nodes to be visually distinct but professional.
    6. Add a classDef for 'styleClass' and apply it to key nodes to make them pop.`
  },
  sequenceDiagram: {
    id: 'sequenceDiagram',
    label: 'Sequence',
    icon: 'ArrowRightLeft',
    description: 'Interactions between systems or participants over time',
    defaultCode: 'sequenceDiagram\n  participant Alice\n  participant Bob\n  Alice->>Bob: Hello Bob, how are you?\n  Bob-->>Alice: I am good thanks!',
    systemPrompt: `Create a detailed sequence diagram.
    Requirements:
    1. Use VALID Mermaid.js sequenceDiagram syntax.
    2. Define participants clearly with 'participant' or 'actor'.
    3. Use varied arrow types: ->>, -->>, -x, etc. appropriately.
    4. Use 'activate' and 'deactivate' to show processing time.
    5. Use 'note left of', 'note right of' for context.
    6. Use 'loop', 'alt', 'opt' blocks for logic flow.`
  },
  classDiagram: {
    id: 'classDiagram',
    label: 'Class',
    icon: 'BoxSelect',
    description: 'Object-oriented structure and relationships',
    defaultCode: 'classDiagram\n  class Animal{\n    +String name\n    +move()\n  }\n  class Dog{\n    +bark()\n  }\n  Animal <|-- Dog',
    systemPrompt: `Create a comprehensive class diagram.
    Requirements:
    1. Use VALID Mermaid.js classDiagram syntax.
    2. Define classes with properties and methods (typing +,-,#).
    3. Show relationships correctly: inheritance (<|--), composition (*--), aggregation (o--), association (-->).
    4. Add cardinality where appropriate "1" .. "*" etc.
    5. Keep class names PascalCase.`
  },
  erDiagram: {
    id: 'erDiagram',
    label: 'ER Diagram',
    icon: 'Database',
    description: 'Database schemas and entity relationships',
    defaultCode: 'erDiagram\n  CUSTOMER ||--o{ ORDER : places\n  ORDER ||--|{ LINE-ITEM : contains',
    systemPrompt: `Create a detailed Entity Relationship Diagram.
    Requirements:
    1. Use VALID Mermaid.js erDiagram syntax.
    2. Define entities and their attributes (type name).
    3. Use correct cardinality symbols: ||--||, ||--|{, }|..|{ etc.
    4. Label relationships clearly (e.g., "contains", "belongs to").
    5. Include Primary Keys (PK) and Foreign Keys (FK) if detailed.`
  },
  pie: {
    id: 'pie',
    label: 'Pie Chart',
    icon: 'PieChart',
    description: 'Statistical proportions and percentages',
    defaultCode: 'pie title Pets adopted by volunteers\n  "Dogs" : 386\n  "Cats" : 85\n  "Rats" : 15',
    systemPrompt: `Create a data-driven pie chart.
    Requirements:
    1. Use VALID Mermaid.js pie syntax.
    2. Include a descriptive title.
    3. Provide realistic data values (they don't need to sum to 100, mermaid handles percentage).
    4. Use double quotes for labels.
    5. concise text`
  },
  requirementDiagram: {
    id: 'requirementDiagram',
    label: 'Requirement',
    icon: 'ListChecks',
    description: 'System requirements and their relationships',
    defaultCode: 'requirementDiagram\n  requirement test_req {\n  id: 1\n  text: the test requirement\n  risk: high\n  verifymethod: test\n  }',
    systemPrompt: `Create a formal requirement diagram.
    Requirements:
    1. Use VALID Mermaid.js requirementDiagram syntax.
    2. Define requirements with id, text, risk, and verifyMethod.
    3. Define elements that satisfy requirements.
    4. Show relationships: satisfies, trace, contains, etc.`
  }
};
