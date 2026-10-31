import { useCallback, useEffect, useEffectEvent, useState } from 'react';

import { ErroApi } from './api';

type Resultado<T> = { chave: string; dados?: T; erro?: string; codigo?: string; status?: number };

/** Carrega dados do site, com recarregar (puxar para atualizar) e mensagem de erro para mostrar ao cliente. */
export function useDados<T>(carregar: () => Promise<T>, dependencias: unknown[]) {
  const [versao, setVersao] = useState(0);
  const [resultado, setResultado] = useState<Resultado<T>>();
  const chave = `${JSON.stringify(dependencias)}#${versao}`;
  const buscar = useEffectEvent(carregar);

  useEffect(() => {
    let ativo = true;
    buscar().then(
      (dados) => ativo && setResultado({ chave, dados }),
      (e) =>
        ativo &&
        setResultado((antes) => ({
          chave,
          dados: antes?.dados,
          erro: e instanceof ErroApi ? e.message : 'Não conseguimos carregar agora. Tente de novo.',
          // Código e status do site (ex.: 404 "nao_encontrado", "conjunto"); sem eles, foi a rede que falhou.
          codigo: e instanceof ErroApi ? e.codigo : undefined,
          status: e instanceof ErroApi ? e.status : undefined,
        })),
    );
    return () => {
      ativo = false;
    };
  }, [chave]);

  const recarregar = useCallback(() => setVersao((v) => v + 1), []);
  // Enquanto a chave nova não chega, mostra o que já tinha (puxar para atualizar não pisca a tela).
  return {
    dados: resultado?.dados,
    erro: resultado?.erro,
    /** Código do erro que o site mandou (ex.: 'nao_encontrado', 'conjunto'). */
    codigo: resultado?.codigo,
    /** Status HTTP do erro do site; 0 (ou undefined) quando a falha foi de rede: sem internet ou tempo esgotado. */
    status: resultado?.status,
    carregando: resultado?.chave !== chave,
    recarregar,
  };
}
