import { Image, type ImageProps } from 'expo-image';

import { imagemSemFoto } from '@/lib/api';

/** Foto de produto: sem foto, a imagem padrão "sem foto" do site. */
export function Imagem({ uri, ...props }: Omit<ImageProps, 'source'> & { uri?: string }) {
  return <Image contentFit="contain" transition={150} {...props} source={{ uri: uri || imagemSemFoto }} />;
}
