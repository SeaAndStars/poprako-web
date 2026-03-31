/**
 * 文件用途：统一封装新建项目时的图片来源选择。
 * Electron 客户端优先使用系统目录对话框；web 端回退到 input 目录选择。
 */

/**
 * 选择结果中的单个图片项。
 */
export interface SelectedProjectImageItem {
  /** 页面展示名称。 */
  name: string;
  /** Electron 客户端返回的绝对路径。 */
  path?: string;
  /** web 端回退方案中的浏览器 File 对象。 */
  file?: File;
}

/**
 * 统一后的目录选择结果。
 */
export interface SelectedProjectImageCollection {
  source_kind: "electron-directory" | "web-directory";
  source_label: string;
  files: SelectedProjectImageItem[];
}

/**
 * 判断文件名是否属于支持的图片格式。
 */
function isSupportedImageFileName(fileName: string): boolean {
  return /\.(png|jpe?g|webp|gif|bmp)$/i.test(fileName);
}

/**
 * 对选择结果做统一排序，避免不同平台下页面顺序不一致。
 */
function sortSelectedImages(
  files: SelectedProjectImageItem[],
): SelectedProjectImageItem[] {
  return [...files].sort((leftFile, rightFile) => {
    return leftFile.name.localeCompare(rightFile.name, "zh-CN", {
      numeric: true,
      sensitivity: "base",
    });
  });
}

/**
 * 使用 web 标准 input 选择目录。
 * 该方案同样可以在 Electron 渲染进程中工作，作为兜底回退能力。
 */
function selectProjectImagesByInput(): Promise<SelectedProjectImageCollection | null> {
  return new Promise((resolve) => {
    const fileInput = document.createElement("input") as HTMLInputElement & {
      webkitdirectory?: boolean;
      directory?: boolean;
    };

    fileInput.type = "file";
    fileInput.multiple = true;
    fileInput.accept = "image/*";
    fileInput.webkitdirectory = true;
    fileInput.directory = true;

    fileInput.onchange = () => {
      const fileList = Array.from(fileInput.files ?? []);
      const imageFiles = fileList
        .filter((file) => isSupportedImageFileName(file.name))
        .map((file) => ({
          name: file.webkitRelativePath || file.name,
          file,
        }));

      if (imageFiles.length === 0) {
        resolve(null);
        return;
      }

      const firstFile = fileList[0];
      const fallbackLabel =
        firstFile?.webkitRelativePath?.split("/")[0] || "浏览器本地目录";

      resolve({
        source_kind: "web-directory",
        source_label: fallbackLabel,
        files: sortSelectedImages(imageFiles),
      });
    };

    fileInput.click();
  });
}

/**
 * 选择本地项目图片目录。
 * Electron 端走原生目录选择框；web 端走 input 目录选择。
 */
export async function selectProjectImageCollection(): Promise<SelectedProjectImageCollection | null> {
  const desktopDialog = window.poprakoDesktop?.projectDialog;

  if (desktopDialog) {
    const electronSelection = await desktopDialog.selectProjectDirectory();

    if (electronSelection && electronSelection.files.length > 0) {
      const files = electronSelection.files.filter((fileItem) => {
        return isSupportedImageFileName(fileItem.name);
      });

      if (files.length > 0) {
        return {
          source_kind: "electron-directory",
          source_label: electronSelection.directoryPath,
          files: sortSelectedImages(files),
        };
      }
    }
  }

  return selectProjectImagesByInput();
}