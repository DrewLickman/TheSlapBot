export function getPostFailureMessage(error) {
  if (error?.code === 50013 || error?.status === 403) {
    return 'I could not post in that channel. Give the bot **Send Messages** and **Attach Files** permission, then run `/slap` again.';
  }
  if (error?.status === 404) {
    return 'That channel is no longer available. Run `/slap` in a channel where the bot can post.';
  }

  const errorCode = String(error?.code ?? '');
  const errorName = String(error?.name ?? '');
  if (
    Number(error?.status) >= 500 ||
    /AbortError|Timeout/i.test(errorName) ||
    /ECONNRESET|ETIMEDOUT|EPIPE|UND_ERR|ECONNABORTED/i.test(errorCode)
  ) {
    return 'Discord did not confirm whether the image was posted. Check the channel before trying again; the bot will not resend it automatically.';
  }

  return 'I could not post the image. Check the bot’s channel permissions and try `/slap` again.';
}
