// Native Android Unity Ads Plugin for Capacitor
// 
// INSTRUCTIONS: After running `npx cap add android`, copy this file to:
// android/app/src/main/java/dev/kubovibe/app/UnityAdsPlugin.java
//
// Then register it in MainActivity.java:
//   import dev.kubovibe.app.UnityAdsPlugin;
//   public class MainActivity extends BridgeActivity {
//     @Override
//     public void onCreate(Bundle savedInstanceState) {
//       registerPlugin(UnityAdsPlugin.class);
//       super.onCreate(savedInstanceState);
//     }
//   }
//
// Add to android/app/build.gradle dependencies:
//   implementation 'com.unity3d.ads:unity-ads:4.12.5'

/*
package dev.kubovibe.app;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.unity3d.ads.IUnityAdsInitializationListener;
import com.unity3d.ads.IUnityAdsLoadListener;
import com.unity3d.ads.IUnityAdsShowListener;
import com.unity3d.ads.UnityAds;
import com.unity3d.ads.UnityAdsShowOptions;

@CapacitorPlugin(name = "UnityAds")
public class UnityAdsPlugin extends Plugin {

    @PluginMethod
    public void initialize(PluginCall call) {
        String gameId = call.getString("gameId");
        Boolean testMode = call.getBoolean("testMode", false);

        UnityAds.initialize(getContext(), gameId, testMode, new IUnityAdsInitializationListener() {
            @Override
            public void onInitializationComplete() {
                call.resolve();
            }

            @Override
            public void onInitializationFailed(UnityAds.UnityAdsInitializationError error, String message) {
                call.reject("Unity Ads init failed: " + message);
            }
        });
    }

    @PluginMethod
    public void load(PluginCall call) {
        String adUnitId = call.getString("adUnitId");

        UnityAds.load(adUnitId, new IUnityAdsLoadListener() {
            @Override
            public void onUnityAdsAdLoaded(String placementId) {
                call.resolve();
            }

            @Override
            public void onUnityAdsFailedToLoad(String placementId, UnityAds.UnityAdsLoadError error, String message) {
                call.reject("Ad load failed: " + message);
            }
        });
    }

    @PluginMethod
    public void show(PluginCall call) {
        String adUnitId = call.getString("adUnitId");

        getActivity().runOnUiThread(() -> {
            UnityAds.show(getActivity(), adUnitId, new UnityAdsShowOptions(), new IUnityAdsShowListener() {
                @Override
                public void onUnityAdsShowComplete(String placementId, UnityAds.UnityAdsShowCompletionState state) {
                    var ret = new com.getcapacitor.JSObject();
                    ret.put("completed", state == UnityAds.UnityAdsShowCompletionState.COMPLETED);
                    call.resolve(ret);
                }

                @Override
                public void onUnityAdsShowFailure(String placementId, UnityAds.UnityAdsShowError error, String message) {
                    call.reject("Ad show failed: " + message);
                }

                @Override
                public void onUnityAdsShowStart(String placementId) {}

                @Override
                public void onUnityAdsShowClick(String placementId) {}
            });
        });
    }
}
*/
