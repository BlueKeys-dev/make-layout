import React from 'react';
import { Plus, Minus, ChevronRight, ChevronDown } from 'lucide-react';
import { MindMapNode } from '../types';

interface NodeEditorProps {
  node: MindMapNode;
  onChange: (newNode: MindMapNode) => void;
  onDelete?: () => void;
  depth?: number;
}

export const NodeEditor: React.FC<NodeEditorProps> = ({ node, onChange, onDelete, depth = 0 }) => {
  const [expanded, setExpanded] = React.useState(true);

  const handleLabelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...node, label: e.target.value });
  };

  const addChild = () => {
    const newChildren = [...(node.children || []), { label: 'New Node' }];
    onChange({ ...node, children: newChildren });
  };

  const updateChild = (index: number, updatedChild: MindMapNode) => {
    const newChildren = [...(node.children || [])];
    newChildren[index] = updatedChild;
    onChange({ ...node, children: newChildren });
  };

  const deleteChild = (index: number) => {
    const newChildren = [...(node.children || [])];
    newChildren.splice(index, 1);
    onChange({ ...node, children: newChildren });
  };

  return (
    <div className="flex flex-col gap-1" style={{ marginLeft: depth * 8 }}>
      <div className="flex items-center gap-1">
        {node.children && node.children.length > 0 ? (
           <button onClick={() => setExpanded(!expanded)} className="p-0.5 hover:bg-black/5 rounded">
             {expanded ? <ChevronDown size={12}/> : <ChevronRight size={12}/>}
           </button>
        ) : <div className="w-3" />}
        
        <input 
          value={node.label} 
          onChange={handleLabelChange}
          className="flex-1 bg-transparent border-b border-transparent hover:border-gray-200 focus:border-primary outline-none text-xs py-0.5 px-1"
        />
        
        <button onClick={addChild} className="p-0.5 text-green-500 hover:bg-green-50 rounded" title="Add Child">
           <Plus size={12}/>
        </button>
        {onDelete && (
           <button onClick={onDelete} className="p-0.5 text-red-500 hover:bg-red-50 rounded" title="Delete Node">
             <Minus size={12}/>
           </button>
        )}
      </div>
      
      {expanded && node.children && (
        <div className="flex flex-col gap-1 border-l border-gray-100 dark:border-gray-700 ml-1.5 pl-1">
          {node.children.map((child, i) => (
             <NodeEditor 
                key={i} 
                node={child} 
                onChange={(n) => updateChild(i, n)} 
                onDelete={() => deleteChild(i)}
                depth={depth + 1}
             />
          ))}
        </div>
      )}
    </div>
  );
};
