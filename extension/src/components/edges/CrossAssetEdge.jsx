import React from 'react';
import { BaseEdge, getBezierPath, EdgeLabelRenderer } from '@xyflow/react';
import { Plus, X, CaretDown, ChatTeardropText } from '@phosphor-icons/react';

export function CrossAssetEdge({ 
  id, 
  sourceX, 
  sourceY, 
  targetX, 
  targetY, 
  sourcePosition, 
  targetPosition, 
  data, 
  style, 
  markerStart,
  markerEnd,
  selected
}) {
  const [edgePath, labelX, labelY] = getBezierPath({ 
    sourceX, 
    sourceY, 
    targetX, 
    targetY, 
    sourcePosition, 
    targetPosition 
  });

  // Place the button at the target dot, but offset slightly so it doesn't cover the arrowhead
  const btnX = targetX;
  const btnY = targetY;

  return (
    <>
      <BaseEdge 
        path={edgePath} 
        markerStart={markerStart}
        markerEnd={markerEnd} 
        style={{ ...style, stroke: '#5B7593', strokeWidth: selected ? 3.5 : 2.5 }} 
      />
      <EdgeLabelRenderer>
        <div 
          style={{ 
            position: 'absolute', 
            // Offset the button slightly along the x and y to avoid covering the arrow
            transform: `translate(-50%, -50%) translate(${btnX}px,${btnY}px)`, 
            marginLeft: 16,
            marginTop: 16,
            pointerEvents: 'all',
            zIndex: 1000
          }}
          className="nodrag nopan"
        >
          {!data?.instructionOpen ? (
            <button 
              onClick={(e) => {
                e.stopPropagation();
                data.onToggleInstruction(id);
              }} 
              className={`edge-plus-btn ${data?.instruction ? 'has-text' : ''}`}
              title={data?.instruction ? "Read instruction" : "Add instruction"}
            >
              {data?.instruction ? <ChatTeardropText size={16} weight="fill" /> : <Plus size={16} weight="bold" />}
            </button>
          ) : (
            <div className={`edge-instruction-container ${selected ? 'selected' : ''}`}>
              <textarea 
                autoFocus
                className="edge-instruction"
                value={data.instruction || ''}
                onChange={(e) => data.onChangeInstruction(id, e.target.value)}
                placeholder="Type your instruction..."
              />
              <div className="edge-instruction-actions">
                <button 
                  className="edge-action-btn minimize" 
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    data.onToggleInstruction(id); 
                  }} 
                  title="Minimize"
                >
                  <CaretDown size={14} weight="bold" />
                </button>
                {selected && (
                  <button 
                    className="edge-action-btn delete" 
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      data.onDeleteInstruction(id); 
                    }} 
                    title="Remove instruction"
                  >
                    <X size={14} weight="bold" />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
