import React, { useState, useEffect } from 'react';

const WavyGridBackground = () => {
  const width = 1920;
  const height = 1080;
  const spacing = 40;
  const amplitude = 25;
  const frequency = 0.005;
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setPhase(prev => prev + 0.03);
    }, 50);
    return () => clearInterval(interval);
  }, []);

  const generateHorizontalPath = (baseY) => {
    let path = '';
    for (let x = 0; x <= width; x += 5) {
      const y = baseY + Math.sin(x * frequency + phase) * amplitude;
      if (x === 0) {
        path += `M ${x} ${y}`;
      } else {
        path += ` L ${x} ${y}`;
      }
    }
    return path;
  };

  const generateVerticalPath = (baseX) => {
    let path = '';
    for (let y = 0; y <= height; y += 5) {
      const x = baseX + Math.sin(y * frequency + phase) * amplitude;
      if (y === 0) {
        path += `M ${x} ${y}`;
      } else {
        path += ` L ${x} ${y}`;
      }
    }
    return path;
  };

  const horizontalLines = [];
  for (let y = 0; y <= height; y += spacing) {
    horizontalLines.push(
      <path
        key={`h-${y}`}
        d={generateHorizontalPath(y)}
        stroke="#ccc"
        strokeWidth="2"
        fill="none"
      />
    );
  }

  const verticalLines = [];
  for (let x = 0; x <= width; x += spacing) {
    verticalLines.push(
      <path
        key={`v-${x}`}
        d={generateVerticalPath(x)}
        stroke="#ccc"
        strokeWidth="2"
        fill="none"
      />
    );
  }

  return (
    <svg
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: -1,
      }}
      viewBox={`0 0 ${width} ${height}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      {horizontalLines}
      {verticalLines}
    </svg>
  );
};

export default WavyGridBackground;