/**
 * 文件用途：封装用户头像的预留、直传与确认流程。
 * 注册页与标题栏资料编辑都复用这条上传链路，避免各自维护一套实现。
 */
import { confirmUserAvatarUploaded, reserveUserAvatar } from "./modules";
import {
  resolveImageFileExtension,
  uploadFileToPresignedPutUrl,
} from "./objectStorage";

/**
 * 为指定用户完成头像上传。
 */
export async function uploadUserAvatar(
  userID: string,
  avatarFile: File,
): Promise<void> {
  const avatarContentType = avatarFile.type || "application/octet-stream";
  const avatarExtension = resolveImageFileExtension(avatarFile);
  const reserveUserAvatarResult = await reserveUserAvatar(userID, {
    extension: avatarExtension,
    content_type: avatarContentType,
  });

  await uploadFileToPresignedPutUrl(
    reserveUserAvatarResult.put_url,
    avatarFile,
    avatarContentType,
  );
  await confirmUserAvatarUploaded(userID);
}
