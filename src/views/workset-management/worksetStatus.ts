export const WORKSET_STATUS_OPTIONS = [
  { label: "连载中", value: "连载中" },
  { label: "弃坑", value: "弃坑" },
  { label: "缺图断更", value: "缺图断更" },
  { label: "完结", value: "完结" },
] as const;

export function resolveWorksetStatusColor(status?: string): string {
  switch (status) {
    case "连载中":
      return "blue";
    case "弃坑":
      return "default";
    case "缺图断更":
      return "orange";
    case "完结":
      return "green";
    default:
      return "default";
  }
}
