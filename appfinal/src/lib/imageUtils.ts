
export async function compressImage(file: File, maxWidth = 1200, quality = 0.7): Promise<Blob> {
  console.log("Iniciando compressão de imagem...");
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      console.log("FileReader concluído.");
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        console.log(`Imagem carregada: ${img.width}x${img.height}`);
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = (maxWidth / width) * height;
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error("Falha ao obter contexto 2D do canvas"));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);

        console.log(`Convertendo canvas para blob (qualidade: ${quality})...`);
        canvas.toBlob(
          (blob) => {
            if (blob) {
              console.log(`Compressão concluída. Tamanho final: ${(blob.size / 1024).toFixed(2)} KB`);
              resolve(blob);
            } else {
              reject(new Error('Canvas to Blob conversion failed'));
            }
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = (err) => {
        console.error("Erro ao carregar imagem para canvas:", err);
        reject(err);
      };
    };
    reader.onerror = (err) => {
      console.error("Erro no FileReader:", err);
      reject(err);
    };
  });
}
