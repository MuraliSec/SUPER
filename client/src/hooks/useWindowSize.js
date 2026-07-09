import { useState, useEffect } from 'react';

export function useWindowSize() {
  const [size, setSize] = useState({ width: window.innerWidth, height: window.innerHeight });

  useEffect(() => {
    let timer;
    const handle = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        setSize({ width: window.innerWidth, height: window.innerHeight });
      }, 150);
    };
    window.addEventListener('resize', handle);
    return () => { window.removeEventListener('resize', handle); clearTimeout(timer); };
  }, []);

  return size;
}
