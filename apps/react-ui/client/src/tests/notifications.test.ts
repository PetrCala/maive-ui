import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  requestNotificationPermission,
  notifyRunComplete,
} from "@src/utils/notifications";

type Perm = "default" | "granted" | "denied";

const constructed: Array<{ title: string; options?: NotificationOptions }> = [];

const requestPermissionMock = vi.fn(
  (): Promise<Perm> => Promise.resolve("granted"),
);

class MockNotification {
  static permission: Perm = "granted";

  static requestPermission = requestPermissionMock;

  onclick: (() => void) | null = null;

  constructor(title: string, options?: NotificationOptions) {
    constructed.push({ title, options });
  }
}

const installNotification = (permission: Perm) => {
  MockNotification.permission = permission;
  vi.stubGlobal("Notification", MockNotification);
};

describe("notifications", () => {
  beforeEach(() => {
    constructed.length = 0;
    requestPermissionMock.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("notifyRunComplete", () => {
    it("returns false when notifications are unsupported", () => {
      expect(
        notifyRunComplete({
          jobId: "j1",
          modelType: "RTMA",
          status: "succeeded",
        }),
      ).toBe(false);
    });

    it("returns false (and shows nothing) when permission is not granted", () => {
      installNotification("default");
      expect(
        notifyRunComplete({
          jobId: "j1",
          modelType: "RTMA",
          status: "succeeded",
        }),
      ).toBe(false);
      expect(constructed).toHaveLength(0);
    });

    it("shows a success notification when permission is granted", () => {
      installNotification("granted");
      const shown = notifyRunComplete({
        jobId: "j1",
        modelType: "MAIVE",
        status: "succeeded",
      });
      expect(shown).toBe(true);
      expect(constructed).toHaveLength(1);
      expect(constructed[0].title).toBe("MAIVE run finished");
      expect(constructed[0].options?.tag).toBe("j1");
    });

    it("labels a failed run", () => {
      installNotification("granted");
      notifyRunComplete({ jobId: "j2", modelType: "RTMA", status: "failed" });
      expect(constructed[0].title).toBe("RTMA run failed");
    });

    it("labels a timed-out run", () => {
      installNotification("granted");
      notifyRunComplete({ jobId: "j3", modelType: "RTMA", status: "timedout" });
      expect(constructed[0].title).toBe("RTMA run timed out");
    });

    it("does not notify for an expired run", () => {
      installNotification("granted");
      const shown = notifyRunComplete({
        jobId: "j4",
        modelType: "RTMA",
        status: "expired",
      });
      expect(shown).toBe(false);
      expect(constructed).toHaveLength(0);
    });
  });

  describe("requestNotificationPermission", () => {
    it("requests permission when the user has not decided", () => {
      installNotification("default");
      requestNotificationPermission();
      expect(requestPermissionMock).toHaveBeenCalledTimes(1);
    });

    it("does nothing once permission is already decided", () => {
      installNotification("denied");
      requestNotificationPermission();
      expect(requestPermissionMock).not.toHaveBeenCalled();
    });

    it("does nothing when notifications are unsupported", () => {
      requestNotificationPermission();
      expect(requestPermissionMock).not.toHaveBeenCalled();
    });
  });
});
