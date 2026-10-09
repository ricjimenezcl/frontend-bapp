package io.ionic.bappsearch;

import android.content.Context;
import android.content.res.Configuration;
import android.os.Bundle;
import android.webkit.WebSettings;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    /**
     * Ignora la escala de fuente del sistema (Ajustes > Pantalla > Tamaño de
     * fuente). Sin esto, en equipos como el Honor 400 Smart la UI completa se
     * ve ampliada porque el WebView multiplica los textos por fontScale.
     */
    @Override
    protected void attachBaseContext(Context newBase) {
        Configuration config = new Configuration(newBase.getResources().getConfiguration());
        config.fontScale = 1.0f;
        super.attachBaseContext(newBase.createConfigurationContext(config));
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        lockWebViewTextZoom();
    }

    @Override
    public void onResume() {
        super.onResume();
        lockWebViewTextZoom();
    }

    private void lockWebViewTextZoom() {
        if (getBridge() == null || getBridge().getWebView() == null) return;
        WebSettings settings = getBridge().getWebView().getSettings();
        settings.setTextZoom(100);
    }
}
