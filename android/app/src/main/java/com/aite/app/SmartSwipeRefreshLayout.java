package com.aite.app;

import android.content.Context;
import android.util.AttributeSet;
import android.view.MotionEvent;
import android.view.ViewConfiguration;

import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;

/**
 * SwipeRefreshLayout لا يخطف اللمس من المحتوى الداخلي.
 * يبدأ السحب للتحديث فقط عندما تكون الإيماءة عمودية بوضوح وتتجاوز عتبة اللمس،
 * وعندما لا يستطيع المحتوى التمرير للأعلى — فيمرر التمرير العادي (الرسائل مثلًا)
 * إلى الصفحة دون اعتراض.
 */
public class SmartSwipeRefreshLayout extends SwipeRefreshLayout {

    private final int touchSlop;
    private float downX;
    private float downY;
    private boolean gestureDecided;

    public SmartSwipeRefreshLayout(Context context) {
        super(context);
        touchSlop = ViewConfiguration.get(context).getScaledTouchSlop();
    }

    public SmartSwipeRefreshLayout(Context context, AttributeSet attrs) {
        super(context, attrs);
        touchSlop = ViewConfiguration.get(context).getScaledTouchSlop();
    }

    @Override
    public boolean onInterceptTouchEvent(MotionEvent event) {
        switch (event.getActionMasked()) {
            case MotionEvent.ACTION_DOWN:
                downX = event.getX();
                downY = event.getY();
                gestureDecided = false;
                break;
            case MotionEvent.ACTION_MOVE:
                if (!gestureDecided) {
                    float dx = Math.abs(event.getX() - downX);
                    float dy = event.getY() - downY;
                    // سحب للأسفل عمودي بوضوح ومتجاوز للعتبة = تحديث، وإلا اتركه للصفحة
                    if (dy > touchSlop * 2 && dy > Math.abs(dx) * 1.5f) {
                        gestureDecided = true;
                    } else if (Math.abs(dx) > touchSlop || dy < -touchSlop) {
                        gestureDecided = true;
                        return false;
                    }
                }
                break;
        }
        return super.onInterceptTouchEvent(event);
    }
}
