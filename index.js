// Entrada do app. A tarefa das boas-vindas com o app fechado vem antes das telas: no Android, o celular acorda o app sem
// tela só para rodá-la, e ela precisa estar definida já no carregamento do JS. Caminho relativo, sem o atalho @/.
import './src/lib/tarefa-boas-vindas';
import 'expo-router/entry';
