package app.gaspalli.android

import android.content.Intent
import android.net.Uri
import android.provider.AlarmClock
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Intégrations Android de Gaspalli :
 * - « Partager vers Gaspalli » : lien de recette, texte d'un e-mail de commande drive,
 *   ou image(s) (ticket, capture de commande, photo de recette) reçus d'une autre app ;
 * - minuteur de cuisine lancé dans l'horloge du téléphone (ACTION_SET_TIMER).
 */
class GaspalliAndroidModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("GaspalliAndroid")
    Events("onShare")

    /** Partage qui a ouvert l'app (lancement à froid), une seule fois. */
    Function("takeShared") {
      val activity = appContext.currentActivity
      val shared = payload(activity?.intent)
      if (activity != null && shared != null) {
        activity.intent = Intent(Intent.ACTION_MAIN)
      }
      shared
    }

    /** Partage reçu alors que l'app est déjà ouverte. */
    OnNewIntent { intent ->
      val shared = payload(intent)
      if (shared != null) sendEvent("onShare", shared)
    }

    /** Lance un minuteur dans l'horloge du téléphone, sans quitter l'app. false si aucune horloge compatible. */
    Function("startTimer") { seconds: Int, message: String ->
      val activity = appContext.currentActivity
      if (activity == null) {
        false
      } else {
        val intent = Intent(AlarmClock.ACTION_SET_TIMER).apply {
          putExtra(AlarmClock.EXTRA_LENGTH, seconds)
          putExtra(AlarmClock.EXTRA_MESSAGE, message)
          putExtra(AlarmClock.EXTRA_SKIP_UI, true)
        }
        try {
          activity.startActivity(intent)
          true
        } catch (e: Exception) {
          false
        }
      }
    }
  }

  private fun payload(intent: Intent?): Map<String, Any?>? {
    if (intent == null) return null
    val action = intent.action
    if (action != Intent.ACTION_SEND && action != Intent.ACTION_SEND_MULTIPLE) return null
    val uris = ArrayList<String>()
    if (action == Intent.ACTION_SEND) {
      @Suppress("DEPRECATION")
      val stream: Uri? = intent.getParcelableExtra(Intent.EXTRA_STREAM)
      if (stream != null) uris.add(stream.toString())
    } else {
      @Suppress("DEPRECATION")
      val streams: ArrayList<Uri>? = intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM)
      streams?.forEach { uris.add(it.toString()) }
    }
    val text = intent.getStringExtra(Intent.EXTRA_TEXT)
    if (text == null && uris.isEmpty()) return null
    return mapOf("text" to text, "uris" to uris)
  }
}
