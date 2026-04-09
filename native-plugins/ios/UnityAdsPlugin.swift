// Native iOS Unity Ads Plugin for Capacitor
//
// INSTRUCTIONS: After running `npx cap add ios`, copy this file to:
// ios/App/App/UnityAdsPlugin.swift
//
// Then register it in AppDelegate.swift or create UnityAdsPlugin.m:
//   #import <Capacitor/Capacitor.h>
//   CAP_PLUGIN(UnityAdsPlugin, "UnityAds",
//     CAP_PLUGIN_METHOD(initialize, CAPPluginReturnPromise);
//     CAP_PLUGIN_METHOD(load, CAPPluginReturnPromise);
//     CAP_PLUGIN_METHOD(show, CAPPluginReturnPromise);
//   )
//
// Add Unity Ads SDK via CocoaPods in ios/App/Podfile:
//   pod 'UnityAds', '~> 4.12'
// Then run: cd ios/App && pod install

/*
import Capacitor
import UnityAds

@objc(UnityAdsPlugin)
public class UnityAdsPlugin: CAPPlugin, UnityAdsInitializationDelegate, UnityAdsLoadDelegate, UnityAdsShowDelegate {
    
    private var initCall: CAPPluginCall?
    private var loadCall: CAPPluginCall?
    private var showCall: CAPPluginCall?
    
    @objc func initialize(_ call: CAPPluginCall) {
        let gameId = call.getString("gameId") ?? ""
        let testMode = call.getBool("testMode") ?? false
        
        initCall = call
        UnityAds.initialize(gameId, testMode: testMode, initializationDelegate: self)
    }
    
    public func initializationComplete() {
        initCall?.resolve()
        initCall = nil
    }
    
    public func initializationFailed(_ error: UnityAdsInitializationError, withMessage message: String) {
        initCall?.reject("Init failed: \(message)")
        initCall = nil
    }
    
    @objc func load(_ call: CAPPluginCall) {
        let adUnitId = call.getString("adUnitId") ?? ""
        loadCall = call
        UnityAds.load(adUnitId, loadDelegate: self)
    }
    
    public func unityAdsAdLoaded(_ placementId: String) {
        loadCall?.resolve()
        loadCall = nil
    }
    
    public func unityAdsAdFailed(toLoad placementId: String, withError error: UnityAdsLoadError, withMessage message: String) {
        loadCall?.reject("Load failed: \(message)")
        loadCall = nil
    }
    
    @objc func show(_ call: CAPPluginCall) {
        let adUnitId = call.getString("adUnitId") ?? ""
        showCall = call
        
        DispatchQueue.main.async {
            UnityAds.show(self.bridge?.viewController ?? UIViewController(), placementId: adUnitId, showDelegate: self)
        }
    }
    
    public func unityAdsShowComplete(_ placementId: String, withFinish state: UnityAdsShowCompletionState) {
        showCall?.resolve(["completed": state == .completed])
        showCall = nil
    }
    
    public func unityAdsShowFailed(_ placementId: String, withError error: UnityAdsShowError, withMessage message: String) {
        showCall?.reject("Show failed: \(message)")
        showCall = nil
    }
    
    public func unityAdsShowStart(_ placementId: String) {}
    public func unityAdsShowClick(_ placementId: String) {}
}
*/
