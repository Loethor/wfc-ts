import { SampleSelector } from './sampleSelector';

const images = import.meta.glob('/samples/*', {
    eager: true,
    query: '?url',
    import: 'default'
  });
  

const fullPaths = Object.values(images) as string[];
new SampleSelector('sample-selector', fullPaths);
  
