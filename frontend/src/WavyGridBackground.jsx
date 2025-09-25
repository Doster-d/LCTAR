import React, { useState, useEffect } from 'react';

const WavyGridBackground = () => {
  const [dimensions, setDimensions] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1920,
    height: typeof window !== 'undefined' ? window.innerHeight : 1080
  });
  const [viewportHeight, setViewportHeight] = useState(
    typeof window !== 'undefined' ? (window.visualViewport ? window.visualViewport.height : window.innerHeight) : 1080
  );
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth <= 768 : false
  );
  const spacing = 40;
  const amplitude = 25;
  const frequency = 0.005;
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const handleResize = () => {
      const newWidth = window.innerWidth;
      const newHeight = window.innerHeight;
      setDimensions({
        width: newWidth,
        height: newHeight
      });
      setIsMobile(newWidth <= 768);

      if (window.visualViewport) {
        setViewportHeight(window.visualViewport.height);
      }
    };

    const handleVisualViewportChange = () => {
      if (window.visualViewport) {
        setViewportHeight(window.visualViewport.height);
        setDimensions({
          width: window.innerWidth,
          height: window.innerHeight
        });
        setIsMobile(window.innerWidth <= 768);
      }
    };

    window.addEventListener('resize', handleResize);
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleVisualViewportChange);
    }
    return () => {
      window.removeEventListener('resize', handleResize);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleVisualViewportChange);
      }
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setPhase(prev => prev + 0.03);
    }, 50);
    return () => clearInterval(interval);
  }, []);

  const generateHorizontalPath = (baseY) => {
    let path = '';
    const extendedWidth = dimensions.width + spacing;
    for (let x = -spacing; x <= extendedWidth; x += 5) {
      const y = baseY + Math.sin(x * frequency + phase) * amplitude;
      if (x === -spacing) {
        path += `M ${x} ${y}`;
      } else {
        path += ` L ${x} ${y}`;
      }
    }
    return path;
  };

  const generateVerticalPath = (baseX) => {
    let path = '';
    const extendedHeight = dimensions.height + spacing;
    for (let y = -spacing; y <= extendedHeight; y += 5) {
      const x = baseX + Math.sin(y * frequency + phase) * amplitude;
      if (y === -spacing) {
        path += `M ${x} ${y}`;
      } else {
        path += ` L ${x} ${y}`;
      }
    }
    return path;
  };

  const horizontalLines = [];
  const extendedHeight = dimensions.height + spacing;
  for (let y = -spacing; y <= extendedHeight; y += spacing) {
    horizontalLines.push(
      <path
        key={`h-${y}`}
        d={generateHorizontalPath(y)}
        stroke="#2b2b2b"
        strokeWidth="2"
        fill="none"
      />
    );
  }

  const verticalLines = [];
  const extendedWidth = dimensions.width + spacing;
  for (let x = -spacing; x <= extendedWidth; x += spacing) {
    verticalLines.push(
      <path
        key={`v-${x}`}
        d={generateVerticalPath(x)}
        stroke="#2b2b2b"
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
        minHeight: '100vh',
        minWidth: '100vw',
        zIndex: -1,
        margin: 0,
        padding: 0,
        background: '#0b0b0b',
        ...(isMobile && {
          height: viewportHeight ? `${viewportHeight}px` : '100vh',
          maxHeight: '100vh',
          overflow: 'hidden'
        })
      }}
      viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="none"
    >
      <rect
        width="100%"
        height="100%"
        fill="#0b0b0b"
      />
      {horizontalLines}
      {verticalLines}
    </svg>
  );
};

export default WavyGridBackground;