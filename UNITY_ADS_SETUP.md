# 📱 Unity Ads - Guia de Setup Nativo

## Pré-requisitos
- Android Studio (para Android)
- Xcode (para iOS, requer Mac)
- Node.js instalado

## 1. Exportar e clonar o projeto

1. Clique em **Export to GitHub** no Lovable
2. Clone o repositório:
   ```bash
   git clone https://github.com/SEU_USUARIO/SEU_REPO.git
   cd SEU_REPO
   npm install
   ```

## 2. Build do projeto
```bash
npm run build
```

## 3. Adicionar plataformas nativas

### Android
```bash
npx cap add android
```

### iOS
```bash
npx cap add ios
```

## 4. Configurar Unity Ads SDK

### Android

1. Copie o plugin nativo:
   ```bash
   cp native-plugins/android/UnityAdsPlugin.java android/app/src/main/java/dev/kubovibe/app/
   ```

2. Adicione a dependência do Unity Ads em `android/app/build.gradle`:
   ```gradle
   dependencies {
       implementation 'com.unity3d.ads:unity-ads:4.12.5'
   }
   ```

3. Registre o plugin em `android/app/src/main/java/dev/kubovibe/app/MainActivity.java`:
   ```java
   import android.os.Bundle;
   
   public class MainActivity extends BridgeActivity {
       @Override
       public void onCreate(Bundle savedInstanceState) {
           registerPlugin(UnityAdsPlugin.class);
           super.onCreate(savedInstanceState);
       }
   }
   ```

### iOS

1. Copie o plugin nativo:
   ```bash
   cp native-plugins/ios/UnityAdsPlugin.swift ios/App/App/
   ```

2. Crie o bridge header `ios/App/App/UnityAdsPlugin.m`:
   ```objc
   #import <Capacitor/Capacitor.h>
   CAP_PLUGIN(UnityAdsPlugin, "UnityAds",
     CAP_PLUGIN_METHOD(initialize, CAPPluginReturnPromise);
     CAP_PLUGIN_METHOD(load, CAPPluginReturnPromise);
     CAP_PLUGIN_METHOD(show, CAPPluginReturnPromise);
   )
   ```

3. Adicione ao `ios/App/Podfile`:
   ```ruby
   pod 'UnityAds', '~> 4.12'
   ```

4. Instale pods:
   ```bash
   cd ios/App && pod install
   ```

## 5. Sincronizar e rodar

```bash
npx cap sync
npx cap run android  # ou: npx cap run ios
```

## 6. Configuração do Unity Dashboard

- **Game ID**: `zw52l859eq65bwtg`
- **Ad Unit Android**: `Rewarded_Android`
- **Ad Unit iOS**: `Rewarded_iOS`
- **Test Mode**: `false` (produção)

Certifique-se de que as Ad Units estão configuradas como **Rewarded** no [Unity Dashboard](https://dashboard.unity3d.com/).

## Comportamento Dual-Mode

- **No app nativo**: Unity Ads SDK exibe anúncios reais em tela cheia
- **No navegador web**: Fallback com vídeos do YouTube + timer de 15s

O sistema detecta automaticamente a plataforma e usa o método correto.
