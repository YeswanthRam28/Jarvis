import React, { useEffect, useState } from 'react';

interface Memory {
  id: number;
  fact: string;
  created_at: number;
}

interface MemoryBoardProps {
  onClose: () => void;
}

const MemoryBoard: React.FC<MemoryBoardProps> = ({ onClose }) => {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMemories = async () => {
    setLoading(true);
    const res = await (window as any).electron.getMemories();
    if (res.success && res.memories) {
      setMemories(res.memories);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchMemories();
  }, []);

  const handleDelete = async (id: number) => {
    const res = await (window as any).electron.deleteMemory(id);
    if (res.success) {
      setMemories(memories.filter((m) => m.id !== id));
    }
  };

  return (
    <div className="memory-board-overlay">
      <div className="memory-board-panel">
        <div className="memory-board-header">
          <h2>🧠 JARVIS Core Memory</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        
        <p className="memory-desc">
          This is my Semantic Memory. I extract these facts from our daily interactions to personalize my responses. You can delete anything that is incorrect.
        </p>

        <div className="memory-list">
          {loading ? (
            <p className="loading-text">Accessing neural pathways...</p>
          ) : memories.length === 0 ? (
            <p className="empty-text">No long-term memories formed yet.</p>
          ) : (
            memories.map((m) => (
              <div key={m.id} className="memory-item">
                <div className="memory-content">
                  <span className="memory-fact">{m.fact}</span>
                  <span className="memory-date">
                    {new Date(m.created_at).toLocaleString()}
                  </span>
                </div>
                <button 
                  className="delete-memory-btn" 
                  onClick={() => handleDelete(m.id)}
                  title="Erase from memory"
                >
                  🗑️
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default MemoryBoard;
