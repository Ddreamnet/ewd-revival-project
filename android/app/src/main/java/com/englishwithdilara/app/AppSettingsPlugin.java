package com.englishwithdilara.app;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Uygulamanın sistemdeki bildirim ayarları sayfasını açar.
 *
 * Bildirim izni reddedildikten sonra Android sistem penceresini bir daha
 * göstermiyor; kullanıcının izni geri açabileceği tek yer bu sayfa. WebView
 * içinden bir adresle açılamadığı için küçük bir yerel eklenti gerekiyor
 * (JS tarafı: src/lib/pushNotifications.ts → bildirimAyarlariniAc).
 */
@CapacitorPlugin(name = "AppSettings")
public class AppSettingsPlugin extends Plugin {

    @PluginMethod
    public void openNotificationSettings(PluginCall call) {
        String packageName = getContext().getPackageName();

        Intent intent;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            intent = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS);
            intent.putExtra(Settings.EXTRA_APP_PACKAGE, packageName);
        } else {
            intent = appDetailsIntent(packageName);
        }
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

        try {
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception first) {
            // Bazı üretici arayüzlerinde bildirim sayfası doğrudan açılmıyor;
            // uygulamanın genel ayar sayfası her cihazda var.
            try {
                Intent fallback = appDetailsIntent(packageName);
                fallback.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(fallback);
                call.resolve();
            } catch (Exception second) {
                call.reject("Ayarlar sayfası açılamadı");
            }
        }
    }

    private Intent appDetailsIntent(String packageName) {
        Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
        intent.setData(Uri.fromParts("package", packageName, null));
        return intent;
    }
}
