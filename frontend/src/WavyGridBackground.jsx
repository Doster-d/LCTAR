import React, { useState, useEffect } from 'react';

const WavyGridBackground = () => {
  const [dimensions, setDimensions] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1920,
    height: typeof window !== 'undefined' ? window.innerHeight : 1080
  });
  const spacing = 40;
  const amplitude = 25;
  const frequency = 0.005;
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const handleResize = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setPhase(prev => prev + 0.03);
    }, 50);
    return () => clearInterval(interval);
  }, []);

  const generateHorizontalPath = (baseY) => {
    let path = '';
    for (let x = 0; x <= dimensions.width; x += 5) {
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
    for (let y = 0; y <= dimensions.height; y += 5) {
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
  for (let y = 0; y <= dimensions.height; y += spacing) {
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
  for (let x = 0; x <= dimensions.width; x += spacing) {
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
        margin: 0,
        padding: 0,
      }}
      viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      {horizontalLines}
      {verticalLines}
    </svg>
  );
};

export default WavyGridBackground;