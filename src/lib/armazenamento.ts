// Guarda o que o cliente deixa no celular (carrinho, loja, favoritos, conversas). Sem cartão, nunca: o cartão vai
// direto para o serviço de pagamento. Nesta demonstração ainda não há token de login; com o backend, ele vai para o cofre
// do celular (expo-secure-store, num módulo próprio), nunca aqui.

import AsyncStorage from '@react-native-async-storage/async-storage';

export async function ler<T>(chave: string, padrao: T): Promise<T> {
  try {
    const valor = await AsyncStorage.getItem(chave);
    return valor ? (JSON.parse(valor) as T) : padrao;
  } catch {
    return padrao;
  }
}

export async function gravar(chave: string, valor: unknown) {
  try {
    await AsyncStorage.setItem(chave, JSON.stringify(valor));
  } catch {
    // Sem espaço ou sem permissão: o app segue com o que tem na memória.
  }
}

/** Apaga do celular as chaves dadas (ao sair da conta, por exemplo). */
export async function apagar(chaves: string[]) {
  try {
    await AsyncStorage.multiRemove(chaves);
  } catch {
    // Se falhar, o que estiver na memória é zerado pelos provedores e regravado na próxima mudança.
  }
}
