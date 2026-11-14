import { discoverSeeds } from './discovery.mjs';

self.onmessage = ({ data: { start, count } }) => {
  self.postMessage(discoverSeeds(start, count));
};
