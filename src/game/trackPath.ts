export const TRACK_LOOP_LENGTH = 1800;

function wrapDistance(distance: number) {
  return ((distance % TRACK_LOOP_LENGTH) + TRACK_LOOP_LENGTH) % TRACK_LOOP_LENGTH;
}

export function trackCenterAt(distance: number) {
  const d = wrapDistance(distance);
  return rawTrackCenter(d) - rawTrackCenter(0);
}

export function trackCurveAt(distance: number) {
  const sample = 8;
  return (trackCenterAt(distance + sample) - trackCenterAt(distance - sample)) / (sample * 2);
}

function rawTrackCenter(distance: number) {
  const lap = (distance / TRACK_LOOP_LENGTH) * Math.PI * 4;
  return Math.sin(distance / 115) * 5.8 + Math.sin((distance - 260) / 190) * 4.2 + Math.sin(lap) * 2;
}
