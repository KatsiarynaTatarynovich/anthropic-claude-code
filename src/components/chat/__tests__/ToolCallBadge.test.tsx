import { test, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { getToolLabel, ToolCallBadge } from "../ToolCallBadge";

afterEach(() => {
  cleanup();
});

// getToolLabel unit tests

test("getToolLabel: str_replace_editor create", () => {
  expect(getToolLabel("str_replace_editor", { command: "create", path: "/App.jsx" })).toBe("Creating /App.jsx");
});

test("getToolLabel: str_replace_editor str_replace", () => {
  expect(getToolLabel("str_replace_editor", { command: "str_replace", path: "/Card.jsx" })).toBe("Editing /Card.jsx");
});

test("getToolLabel: str_replace_editor insert", () => {
  expect(getToolLabel("str_replace_editor", { command: "insert", path: "/Card.jsx" })).toBe("Editing /Card.jsx");
});

test("getToolLabel: str_replace_editor view", () => {
  expect(getToolLabel("str_replace_editor", { command: "view", path: "/App.jsx" })).toBe("Viewing /App.jsx");
});

test("getToolLabel: str_replace_editor undo_edit", () => {
  expect(getToolLabel("str_replace_editor", { command: "undo_edit", path: "/App.jsx" })).toBe("Undoing edit to /App.jsx");
});

test("getToolLabel: str_replace_editor unknown command falls back to edit", () => {
  expect(getToolLabel("str_replace_editor", { command: "unknown", path: "/App.jsx" })).toBe("Editing /App.jsx");
});

test("getToolLabel: str_replace_editor missing command falls back to edit", () => {
  expect(getToolLabel("str_replace_editor", { path: "/App.jsx" })).toBe("Editing /App.jsx");
});

test("getToolLabel: str_replace_editor missing path produces label without crash", () => {
  expect(getToolLabel("str_replace_editor", { command: "create" })).toBe("Creating ");
});

test("getToolLabel: file_manager delete", () => {
  expect(getToolLabel("file_manager", { command: "delete", path: "/old.jsx" })).toBe("Deleting /old.jsx");
});

test("getToolLabel: file_manager rename", () => {
  expect(getToolLabel("file_manager", { command: "rename", path: "/old.jsx", new_path: "/new.jsx" })).toBe("Renaming /old.jsx → /new.jsx");
});

test("getToolLabel: file_manager unknown command", () => {
  expect(getToolLabel("file_manager", { command: "unknown", path: "/foo.tsx" })).toBe("Managing /foo.tsx");
});

test("getToolLabel: unknown tool returns raw tool name", () => {
  expect(getToolLabel("some_other_tool", { command: "create", path: "/foo.tsx" })).toBe("some_other_tool");
});

// ToolCallBadge component tests

test("ToolCallBadge shows spinner when not complete", () => {
  render(
    <ToolCallBadge
      toolName="str_replace_editor"
      args={{ command: "create", path: "/App.jsx" }}
      isComplete={false}
    />
  );

  const spinner = document.querySelector(".animate-spin");
  const greenDot = document.querySelector(".bg-emerald-500");

  expect(spinner).toBeDefined();
  expect(greenDot).toBeNull();
  expect(screen.getByText("Creating /App.jsx")).toBeDefined();
});

test("ToolCallBadge shows green dot when complete", () => {
  render(
    <ToolCallBadge
      toolName="str_replace_editor"
      args={{ command: "create", path: "/App.jsx" }}
      isComplete={true}
    />
  );

  const spinner = document.querySelector(".animate-spin");
  const greenDot = document.querySelector(".bg-emerald-500");

  expect(greenDot).toBeDefined();
  expect(spinner).toBeNull();
  expect(screen.getByText("Creating /App.jsx")).toBeDefined();
});

test("ToolCallBadge renders file_manager delete label", () => {
  render(
    <ToolCallBadge
      toolName="file_manager"
      args={{ command: "delete", path: "/old.jsx" }}
      isComplete={true}
    />
  );

  expect(screen.getByText("Deleting /old.jsx")).toBeDefined();
  expect(document.querySelector(".bg-emerald-500")).toBeDefined();
});

test("ToolCallBadge renders unknown tool as raw name", () => {
  render(
    <ToolCallBadge
      toolName="some_other_tool"
      args={{}}
      isComplete={false}
    />
  );

  expect(screen.getByText("some_other_tool")).toBeDefined();
});
