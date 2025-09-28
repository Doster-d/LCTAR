from uuid import UUID

from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from .models import Asset, PromoCode, Session, SessionItemProgress, User, ViewEvent


@override_settings(
    DATABASES={
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": ":memory:",
        }
    }
)
class TestMvpApi(TestCase):
    def setUp(self):
        self.client = APIClient()
        Asset.objects.create(slug="a1", name="Asset 1", type="model")
        Asset.objects.create(slug="a2", name="Asset 2", type="model")
        Asset.objects.create(slug="a3", name="Asset 3", type="model")

    def _start_session(self):
        resp = self.client.post("/session/start/", {}, format="json")
        assert resp.status_code == 201
        session_id = resp.data["session_id"]
        UUID(session_id)
        return session_id

    def _view(self, session_id: str, slug: str):
        return self.client.post(
            "/view/", {"session_id": session_id, "asset_slug": slug}, format="json"
        )

    def test_session_start(self):
        session_id = self._start_session()
        assert Session.objects.filter(id=session_id).exists()
        ev = ViewEvent.objects.filter(
            event_type="session_started", session_id=session_id
        )
        assert ev.count() == 1

    def test_view_awards_points_and_promocode(self):
        session_id = self._start_session()
        r1 = self._view(session_id, "a1")
        assert r1.status_code == 200
        assert r1.data["awarded_points"] == 10
        assert r1.data["session_score"] == 10
        r2 = self._view(session_id, "a2")
        assert r2.data["awarded_points"] == 10
        assert r2.data["session_score"] == 20
        r3 = self._view(session_id, "a3")
        assert "promo_code" in r3.data
        assert r3.data["session_score"] == 30
        assert PromoCode.objects.filter(
            session_id=session_id, code=r3.data["promo_code"]
        ).exists()
        assert (
            ViewEvent.objects.filter(
                event_type="viewed_asset", session_id=session_id
            ).count()
            == 3
        )
        assert (
            ViewEvent.objects.filter(
                event_type="first_view_awarded", session_id=session_id
            ).count()
            == 3
        )
        assert (
            ViewEvent.objects.filter(
                event_type="promo_issued", session_id=session_id
            ).count()
            == 1
        )

    def test_user_email_links_and_updates_score(self):
        session_id = self._start_session()
        self._view(session_id, "a1")
        resp = self.client.post(
            "/user/email/",
            {"session_id": session_id, "email": "test@example.com"},
            format="json",
        )
        assert resp.status_code == 200
        user_id = resp.data["user_id"]
        user = User.objects.get(id=user_id)
        assert user.email == "test@example.com"
        assert user.total_score == 10
        assert (
            ViewEvent.objects.filter(
                event_type="email_submitted", session_id=session_id
            ).count()
            == 1
        )

    def test_progress_endpoints(self):
        session_id = self._start_session()
        self._view(session_id, "a1")
        pr = self.client.get(f"/progress/?session_id={session_id}")
        assert pr.status_code == 200
        assert pr.data["total_assets"] == 3
        assert pr.data["viewed_assets"] == 1
        assert pr.data["remaining_assets"] == 2
        assert pr.data["total_score"] == 10
        assert (
            ViewEvent.objects.filter(
                event_type="progress_viewed", session_id=session_id
            ).count()
            == 1
        )

        self.client.post(
            "/user/email/",
            {"session_id": session_id, "email": "u@example.com"},
            format="json",
        )
        user = User.objects.get(email="u@example.com")

        session2 = self._start_session()
        self.client.post(
            "/user/email/",
            {"session_id": session2, "email": "u@example.com"},
            format="json",
        )
        self._view(session2, "a2")
        upr = self.client.get(f"/progress/?user_id={user.id}")
        assert upr.status_code == 200
        assert upr.data["total_assets"] == 3
        assert upr.data["viewed_assets"] == 2
        assert upr.data["remaining_assets"] == 1
        assert upr.data["total_score"] == 20

    def test_view_missing_params(self):
        r = self.client.post("/view/", {"session_id": ""}, format="json")
        assert r.status_code == 400
        r = self.client.post("/view/", {"asset_slug": "a1"}, format="json")
        assert r.status_code == 400

    def test_view_invalid_ids(self):
        r = self.client.post(
            "/view/",
            {"session_id": "00000000-0000-0000-0000-000000000000", "asset_slug": "a1"},
            format="json",
        )
        assert r.status_code == 404
        session_id = self._start_session()
        r2 = self.client.post(
            "/view/", {"session_id": session_id, "asset_slug": "nope"}, format="json"
        )
        assert r2.status_code == 404

    def test_view_idempotent_points_award(self):
        session_id = self._start_session()
        r1 = self._view(session_id, "a1")
        assert r1.data["awarded_points"] == 10
        r2 = self._view(session_id, "a1")
        assert r2.data["awarded_points"] == 0
        assert r2.data["session_score"] == 10
        sip = SessionItemProgress.objects.get(session_id=session_id, asset__slug="a1")
        assert sip.times_viewed == 2

    def test_user_email_missing_params(self):
        r = self.client.post("/user/email/", {"session_id": ""}, format="json")
        assert r.status_code == 400
        r2 = self.client.post("/user/email/", {"email": "e@example.com"}, format="json")
        assert r2.status_code == 400

    def test_user_email_idempotent_link(self):
        session_id = self._start_session()
        self._view(session_id, "a1")
        r1 = self.client.post(
            "/user/email/",
            {"session_id": session_id, "email": "x@example.com"},
            format="json",
        )
        assert r1.status_code == 200
        r2 = self.client.post(
            "/user/email/",
            {"session_id": session_id, "email": "x@example.com"},
            format="json",
        )
        assert r2.status_code == 200
        assert User.objects.filter(email="x@example.com").count() == 1

    def test_promocode_issued_once_and_bound_on_email(self):
        session_id = self._start_session()
        self._view(session_id, "a1")
        self._view(session_id, "a2")
        r = self._view(session_id, "a3")
        assert "promo_code" in r.data
        code = r.data["promo_code"]
        assert PromoCode.objects.filter(code=code).count() == 1
        r2 = self._view(session_id, "a3")
        assert "promo_code" not in r2.data
        self.client.post(
            "/user/email/",
            {"session_id": session_id, "email": "bind@example.com"},
            format="json",
        )
        pc = PromoCode.objects.get(code=code)
        assert pc.email == "bind@example.com"

    def test_promo_endpoint_by_session_and_user(self):
        session_id = self._start_session()
        r = self.client.get(f"/promo/?session_id={session_id}")
        assert r.status_code == 404
        self._view(session_id, "a1")
        self._view(session_id, "a2")
        self._view(session_id, "a3")
        r2 = self.client.get(f"/promo/?session_id={session_id}")
        assert r2.status_code == 200
        assert "promo_code" in r2.data
        code = r2.data["promo_code"]
        assert (
            ViewEvent.objects.filter(
                event_type="promo_checked",
                session_id=session_id,
                raw_payload__result="issued",
            ).count()
            == 1
        )
        self.client.post(
            "/user/email/",
            {"session_id": session_id, "email": "pp@example.com"},
            format="json",
        )
        user = User.objects.get(email="pp@example.com")
        r3 = self.client.get(f"/promo/?user_id={user.id}")
        assert r3.status_code == 200
        assert r3.data["promo_code"] == code

    def test_user_unique_scoring_across_sessions(self):
        session1 = self._start_session()
        session2 = self._start_session()
        self._view(session1, "a1")
        self.client.post(
            "/user/email/",
            {"session_id": session1, "email": "u2@example.com"},
            format="json",
        )
        self.client.post(
            "/user/email/",
            {"session_id": session2, "email": "u2@example.com"},
            format="json",
        )
        self._view(session2, "a1")
        user = User.objects.get(email="u2@example.com")
        assert user.total_score == 10

    def test_stats_empty(self):
        r = self.client.get("/stats/")
        assert r.status_code == 200
        assert r.data["views_today"] == 0
        assert r.data["views_all_time"] == 0
        assert r.data["best_asset"] is None

    def test_stats_best_asset_heuristic(self):
        s1 = self._start_session()
        s2 = self._start_session()
        self._view(s1, "a1")
        self._view(s1, "a1")
        self._view(s2, "a2")
        s3 = self._start_session()
        self._view(s3, "a2")
        r = self.client.get("/stats/")
        assert r.status_code == 200
        assert r.data["views_today"] == 4
        assert r.data["views_all_time"] == 4
        assert r.data["best_asset"]["slug"] in ("a1", "a2")

    def test_stats_respects_today_not_24h(self):
        s = self._start_session()
        a1 = Asset.objects.get(slug="a1")
        yesterday = timezone.now() - timezone.timedelta(days=1)
        ViewEvent.objects.create(
            session=Session.objects.get(id=s),
            asset=a1,
            raw_payload={},
            timestamp=yesterday,
        )
        self._view(s, "a1")
        r = self.client.get("/stats/")
        assert r.status_code == 200
        assert r.data["views_today"] == 1
        assert r.data["views_all_time"] == 2
