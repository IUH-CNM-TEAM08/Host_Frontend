export const AttachmentService = {
  async getAttachmentByMessageId(_messageId: string) {
    return {
      success: true,
      attachment: null,
      statusMessage: "No attachment service configured",
    };
  },
  async upload(_formData: FormData) {
    return {
      success: true,
      data: null,
      statusMessage: "Upload skipped in compat mode",
    };
  },
};
