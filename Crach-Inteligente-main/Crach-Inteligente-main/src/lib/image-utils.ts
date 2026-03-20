/**
 * Utilitários para processamento de imagens no lado do cliente.
 */

/**
 * Redimensiona e comprime uma imagem Base64.
 * @param base64Str A string Base64 original.
 * @param maxWidth Largura máxima desejada.
 * @param maxHeight Altura máxima desejada.
 * @param quality Qualidade da compressão (0 a 1).
 * @returns Uma promessa que resolve com a nova string Base64 otimizada.
 */
export async function compressImage(
  base64Str: string,
  maxWidth: number = 400,
  maxHeight: number = 500,
  quality: number = 0.7
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      // Mantém a proporção
      if (width > height) {
        if (width > maxWidth) {
          height *= maxWidth / width;
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width *= maxHeight / height;
          height = maxHeight;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Não foi possível obter o contexto do canvas'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      // Retorna a imagem comprimida em formato JPEG para maior economia de espaço
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = (error) => reject(error);
  });
}
