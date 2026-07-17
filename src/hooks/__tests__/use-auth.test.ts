import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useAuth } from "@/hooks/use-auth";
import { signIn as signInAction, signUp as signUpAction } from "@/actions";
import { getAnonWorkData, clearAnonWork } from "@/lib/anon-work-tracker";
import { getProjects } from "@/actions/get-projects";
import { createProject } from "@/actions/create-project";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("@/actions", () => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
}));

vi.mock("@/lib/anon-work-tracker", () => ({
  getAnonWorkData: vi.fn(),
  clearAnonWork: vi.fn(),
}));

vi.mock("@/actions/get-projects", () => ({
  getProjects: vi.fn(),
}));

vi.mock("@/actions/create-project", () => ({
  createProject: vi.fn(),
}));

describe("useAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getAnonWorkData as any).mockReturnValue(null);
    (getProjects as any).mockResolvedValue([]);
    (createProject as any).mockResolvedValue({ id: "default-project-id" });
  });

  describe("initial state", () => {
    test("starts with isLoading false", () => {
      const { result } = renderHook(() => useAuth());
      expect(result.current.isLoading).toBe(false);
    });

    test("exposes signIn, signUp, and isLoading", () => {
      const { result } = renderHook(() => useAuth());
      expect(typeof result.current.signIn).toBe("function");
      expect(typeof result.current.signUp).toBe("function");
      expect(typeof result.current.isLoading).toBe("boolean");
    });
  });

  describe("signIn", () => {
    test("sets isLoading true while in flight and false after completion", async () => {
      let resolveSignIn: (value: any) => void;
      (signInAction as any).mockReturnValue(
        new Promise((resolve) => {
          resolveSignIn = resolve;
        })
      );

      const { result } = renderHook(() => useAuth());

      let signInPromise: Promise<any>;
      act(() => {
        signInPromise = result.current.signIn("test@example.com", "password123");
      });

      await waitFor(() => expect(result.current.isLoading).toBe(true));

      await act(async () => {
        resolveSignIn!({ success: true });
        await signInPromise;
      });

      expect(result.current.isLoading).toBe(false);
    });

    test("calls signIn action with provided credentials", async () => {
      (signInAction as any).mockResolvedValue({ success: true });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("test@example.com", "password123");
      });

      expect(signInAction).toHaveBeenCalledWith(
        "test@example.com",
        "password123"
      );
    });

    test("returns the result from the signIn action", async () => {
      const actionResult = { success: true };
      (signInAction as any).mockResolvedValue(actionResult);

      const { result } = renderHook(() => useAuth());

      let returned: any;
      await act(async () => {
        returned = await result.current.signIn("test@example.com", "password123");
      });

      expect(returned).toEqual(actionResult);
    });

    test("returns failure result and does not run post-sign-in flow on failed sign in", async () => {
      const actionResult = { success: false, error: "Invalid credentials" };
      (signInAction as any).mockResolvedValue(actionResult);

      const { result } = renderHook(() => useAuth());

      let returned: any;
      await act(async () => {
        returned = await result.current.signIn("test@example.com", "wrong");
      });

      expect(returned).toEqual(actionResult);
      expect(getAnonWorkData).not.toHaveBeenCalled();
      expect(pushMock).not.toHaveBeenCalled();
    });

    test("resets isLoading even when the sign in action throws", async () => {
      (signInAction as any).mockRejectedValue(new Error("Network error"));

      const { result } = renderHook(() => useAuth());

      await expect(
        act(async () => {
          await result.current.signIn("test@example.com", "password123");
        })
      ).rejects.toThrow("Network error");

      expect(result.current.isLoading).toBe(false);
    });

    describe("post sign-in redirect flow", () => {
      test("creates a project from anonymous work and redirects to it when anon messages exist", async () => {
        (signInAction as any).mockResolvedValue({ success: true });
        const anonWork = {
          messages: [{ id: "1", role: "user", content: "Hello" }],
          fileSystemData: { "/App.jsx": { type: "file", content: "code" } },
        };
        (getAnonWorkData as any).mockReturnValue(anonWork);
        (createProject as any).mockResolvedValue({ id: "new-project-id" });

        const { result } = renderHook(() => useAuth());

        await act(async () => {
          await result.current.signIn("test@example.com", "password123");
        });

        expect(createProject).toHaveBeenCalledWith(
          expect.objectContaining({
            messages: anonWork.messages,
            data: anonWork.fileSystemData,
          })
        );
        expect(clearAnonWork).toHaveBeenCalled();
        expect(pushMock).toHaveBeenCalledWith("/new-project-id");
        expect(getProjects).not.toHaveBeenCalled();
      });

      test("redirects to most recent existing project when there is no anonymous work", async () => {
        (signInAction as any).mockResolvedValue({ success: true });
        (getAnonWorkData as any).mockReturnValue(null);
        (getProjects as any).mockResolvedValue([
          { id: "recent-project", name: "Recent" },
          { id: "older-project", name: "Older" },
        ]);

        const { result } = renderHook(() => useAuth());

        await act(async () => {
          await result.current.signIn("test@example.com", "password123");
        });

        expect(pushMock).toHaveBeenCalledWith("/recent-project");
        expect(createProject).not.toHaveBeenCalled();
      });

      test("creates a new empty project when there is no anon work and no existing projects", async () => {
        (signInAction as any).mockResolvedValue({ success: true });
        (getAnonWorkData as any).mockReturnValue(null);
        (getProjects as any).mockResolvedValue([]);
        (createProject as any).mockResolvedValue({ id: "brand-new-project" });

        const { result } = renderHook(() => useAuth());

        await act(async () => {
          await result.current.signIn("test@example.com", "password123");
        });

        expect(createProject).toHaveBeenCalledWith(
          expect.objectContaining({
            messages: [],
            data: {},
          })
        );
        expect(pushMock).toHaveBeenCalledWith("/brand-new-project");
      });

      test("ignores anonymous work data that has no messages", async () => {
        (signInAction as any).mockResolvedValue({ success: true });
        (getAnonWorkData as any).mockReturnValue({
          messages: [],
          fileSystemData: {},
        });
        (getProjects as any).mockResolvedValue([{ id: "existing-project" }]);

        const { result } = renderHook(() => useAuth());

        await act(async () => {
          await result.current.signIn("test@example.com", "password123");
        });

        expect(clearAnonWork).not.toHaveBeenCalled();
        expect(pushMock).toHaveBeenCalledWith("/existing-project");
      });
    });
  });

  describe("signUp", () => {
    test("sets isLoading true while in flight and false after completion", async () => {
      let resolveSignUp: (value: any) => void;
      (signUpAction as any).mockReturnValue(
        new Promise((resolve) => {
          resolveSignUp = resolve;
        })
      );

      const { result } = renderHook(() => useAuth());

      let signUpPromise: Promise<any>;
      act(() => {
        signUpPromise = result.current.signUp("test@example.com", "password123");
      });

      await waitFor(() => expect(result.current.isLoading).toBe(true));

      await act(async () => {
        resolveSignUp!({ success: true });
        await signUpPromise;
      });

      expect(result.current.isLoading).toBe(false);
    });

    test("calls signUp action with provided credentials", async () => {
      (signUpAction as any).mockResolvedValue({ success: true });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signUp("new@example.com", "password123");
      });

      expect(signUpAction).toHaveBeenCalledWith(
        "new@example.com",
        "password123"
      );
    });

    test("returns failure result and does not run post-sign-in flow on failed sign up", async () => {
      const actionResult = { success: false, error: "Email already registered" };
      (signUpAction as any).mockResolvedValue(actionResult);

      const { result } = renderHook(() => useAuth());

      let returned: any;
      await act(async () => {
        returned = await result.current.signUp("new@example.com", "password123");
      });

      expect(returned).toEqual(actionResult);
      expect(getAnonWorkData).not.toHaveBeenCalled();
      expect(pushMock).not.toHaveBeenCalled();
    });

    test("runs post sign-up redirect flow on success", async () => {
      (signUpAction as any).mockResolvedValue({ success: true });
      (getAnonWorkData as any).mockReturnValue(null);
      (getProjects as any).mockResolvedValue([]);
      (createProject as any).mockResolvedValue({ id: "fresh-project" });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signUp("new@example.com", "password123");
      });

      expect(pushMock).toHaveBeenCalledWith("/fresh-project");
    });

    test("resets isLoading even when the sign up action throws", async () => {
      (signUpAction as any).mockRejectedValue(new Error("Network error"));

      const { result } = renderHook(() => useAuth());

      await expect(
        act(async () => {
          await result.current.signUp("new@example.com", "password123");
        })
      ).rejects.toThrow("Network error");

      expect(result.current.isLoading).toBe(false);
    });
  });
});
