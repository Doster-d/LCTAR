// Singleton Zappar Pipeline to allow manual GL context binding
import { Pipeline } from '@zappar/zappar-react-three-fiber';

// The Pipeline constructor from this package proxies to underlying zappar pipeline.
// We keep one instance for the entire app so trackers & camera share it.
export const pipeline = new Pipeline();

export default pipeline;
