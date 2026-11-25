package app.gaspalli.android

import android.content.Intent
import android.provider.AlarmClock
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Intégrations Android de Gaspalli :
 * - « Partager vers Gaspalli » : texte (lien de recette) reçu d'une autre app (ACTION_SEND) ;
 * - minuteur de cuisine lancé dans l'horloge du téléphone (ACTION_SET_TIMER).
 */
class GaspalliAndroidModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("GaspalliAndroid")
    Events("onShare")

    /** Texte partagé qui a ouvert l'app (lancement à froid), une seule fois. */
    Function("takeSharedText") {
      val activity = appContext.currentActivity
      val text = sharedText(activity?.intent)
      if (activity != null && text != null) {
        activity.intent = Intent(activity.intent).apply {
          action = Intent.ACTION_MAIN
          removeExtra(Intent.EXTRA_TEXT)
        }
      }
      text
    }

    /** Partage reçu alors que l'app est déjà ouverte. */
    OnNewIntent { intent ->
      val text = sharedText(intent)
      if (text != null) sendEvent("onShare", mapOf("text" to text))
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

  private fun sharedText(intent: Intent?): String? {
    if (intent == null || intent.action != Intent.ACTION_SEND) return null
    if (intent.type?.startsWith("text/") != true) return null
    return intent.getStringExtra(Intent.EXTRA_TEXT)
  }
}
