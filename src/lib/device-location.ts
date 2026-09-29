/**
 * Audit GPS comes only from the device's own location service (navigator.geolocation):
 * high accuracy, never a cached fix, never typed in or inferred from IP / photo metadata.
 */

export type DeviceLocation = {
  lat: number;
  lng: number;
  accuracyM: number | null;
  capturedAt: string;
  source: "device_gps";
};

const POSITION_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  maximumAge: 0,
  timeout: 15_000,
};

export function deviceLocationSupported(): boolean {
  return typeof navigator !== "undefined" && Boolean(navigator.geolocation);
}

function toDeviceLocation(pos: GeolocationPosition): DeviceLocation {
  return {
    lat: pos.coords.latitude,
    lng: pos.coords.longitude,
    accuracyM: Number.isFinite(pos.coords.accuracy) ? Math.round(pos.coords.accuracy) : null,
    capturedAt: new Date(pos.timestamp || Date.now()).toISOString(),
    source: "device_gps",
  };
}

export function describeLocationError(error: GeolocationPositionError | Error | null): string {
  if (!error) return "Device location unavailable.";
  if ("code" in error) {
    if (error.code === 1) return "Location permission denied. Allow location for aislix.com in your browser settings.";
    if (error.code === 2) return "Device GPS could not get a fix. Turn on location services and try again.";
    if (error.code === 3) return "Device GPS timed out. Move near a window or outdoors and retry.";
  }
  return error.message || "Device location unavailable.";
}

/** Fresh single reading from the device GPS. */
export function readDeviceLocation(): Promise<DeviceLocation> {
  return new Promise((resolve, reject) => {
    if (!deviceLocationSupported()) {
      reject(new Error("This device or browser does not provide GPS location."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(toDeviceLocation(pos)),
      (err) => reject(new Error(describeLocationError(err))),
      POSITION_OPTIONS,
    );
  });
}

/** Continuous device GPS updates; returns an unsubscribe function. */
export function watchDeviceLocation(
  onUpdate: (location: DeviceLocation) => void,
  onError: (message: string) => void,
): () => void {
  if (!deviceLocationSupported()) {
    onError("This device or browser does not provide GPS location.");
    return () => {};
  }
  const id = navigator.geolocation.watchPosition(
    (pos) => onUpdate(toDeviceLocation(pos)),
    (err) => onError(describeLocationError(err)),
    POSITION_OPTIONS,
  );
  return () => navigator.geolocation.clearWatch(id);
}
