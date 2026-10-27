package io.github.kirishvijay.effort

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters

// The background sync, every 15 minutes. If something's not allowed (yet), it waits for the next
// run; opening the app syncs straight away anyway.
class SyncWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result = try {
        Sync.run(applicationContext)
        Result.success()
    } catch (e: SecurityException) {
        Result.success()
    } catch (e: Unlinked) {
        Result.success()
    } catch (e: Exception) {
        Result.retry()
    }
}
