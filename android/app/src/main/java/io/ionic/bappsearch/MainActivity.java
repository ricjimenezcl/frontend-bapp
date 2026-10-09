package io.ionic.bappsearch;

import android.content.Context;
import android.content.res.Configuration;
import android.os.Build;
import android.os.Bundle;
import android.util.DisplayMetrics;
import android.webkit.WebSettings;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    /**
     * Ignora dos ajustes del sistema que inflan toda la UI en equipos como el
     * Honor 400 Smart:
     *  1) fontScale (Ajustes > Pantalla > Tamaño de fuente): multiplica el
     *     tamaño de los textos.
     *  2) densityDpi (Ajustes > Pantalla > Tamaño de pantalla / "zoom de
     *     pantalla"): el usuario puede subir la densidad por encima de la
     *     nativa del equipo (ej. 360 en vez de 320 física), lo que reduce el
     *     viewport CSS disponible y hace que CUALQUIER elemento en px (como
     *     el tab bar) ocupe proporcionalmente más pantalla, sin que ningún
     *     cambio de CSS lo pueda compensar. Forzamos DENSITY_DEVICE_STABLE
     *     para ignorar ese "zoom" y usar siempre la densidad real del equipo.
     */
    @Override
    protected void attachBaseContext(Context newBase) {
        Configuration config = new Configuration(newBase.getResources().getConfiguration());
        config.fontScale = 1.0f;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            config.densityDpi = DisplayMetrics.DENSITY_DEVICE_STABLE;
        }
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
