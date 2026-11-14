import { discoverSeeds } from './discovery.mjs';

self.onmessage = ({ data: { start, count, settings, tracks } }) => {
  self.postMessage(discoverSeeds(start, count, 6, settings, tracks));
};
