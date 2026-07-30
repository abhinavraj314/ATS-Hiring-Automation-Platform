import os
import smtplib
import logging
from abc import ABC, abstractmethod
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional
from jinja2 import Environment, FileSystemLoader, select_autoescape
from app.core.config import settings

logger = logging.getLogger(__name__)

# Setup Jinja2 environment for templates
TEMPLATE_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "templates", "emails")
env = Environment(
    loader=FileSystemLoader(TEMPLATE_DIR),
    autoescape=select_autoescape(['html', 'xml'])
)

class EmailProvider(ABC):
    """
    Abstract interface for email delivery providers.
    """
    @abstractmethod
    def send_email(self, to_email: str, subject: str, html_content: str) -> bool:
        pass

class GmailSMTPProvider(EmailProvider):
    """
    Gmail SMTP implementation of EmailProvider.
    """
    def __init__(
        self,
        smtp_host: str,
        smtp_port: int,
        smtp_username: Optional[str],
        smtp_password: Optional[str],
        sender_email: str
    ):
        self.smtp_host = smtp_host
        self.smtp_port = smtp_port
        self.smtp_username = smtp_username.strip() if smtp_username else None
        self.smtp_password = smtp_password.strip() if smtp_password else None
        self.sender_email = sender_email.strip() if sender_email else "noreply@yourdomain.com"

    def send_email(self, to_email: str, subject: str, html_content: str) -> bool:
        # If credentials are not configured, fallback to Mock logger print
        if not self.smtp_username or not self.smtp_password:
            logger.info("Gmail SMTP credentials are not configured. Logging mock email content to stdout.")
            print("\n" + "=" * 60)
            print(f"--- [MOCK GMAIL SMTP EMAIL NOTIFICATION SENT] ---")
            print(f"To:      {to_email}")
            print(f"From:    {self.sender_email}")
            print(f"Subject: {subject}")
            print(f"--- HTML Rendered Body Preview ---")
            preview_lines = [line.strip() for line in html_content.splitlines() if line.strip()]
            for line in preview_lines[:35]:
                print(line)
            print("...")
            print("=" * 60 + "\n")
            return True

        try:
            msg = MIMEMultipart('alternative')
            msg['Subject'] = subject
            msg['From'] = self.sender_email
            msg['To'] = to_email

            part = MIMEText(html_content, 'html')
            msg.attach(part)

            with smtplib.SMTP(self.smtp_host, self.smtp_port) as server:
                server.starttls()
                server.login(self.smtp_username, self.smtp_password)
                server.sendmail(self.sender_email, to_email, msg.as_string())
            
            logger.info(f"Email successfully sent via Gmail SMTP to '{to_email}' with subject '{subject}'.")
            return True
        except Exception as e:
            logger.error(f"Failed to send email via Gmail SMTP to '{to_email}': {e}")
            return False

def get_email_provider() -> EmailProvider:
    """
    Factory function to retrieve the configured EmailProvider.
    """
    return GmailSMTPProvider(
        smtp_host=settings.SMTP_HOST,
        smtp_port=settings.SMTP_PORT,
        smtp_username=settings.SMTP_USERNAME,
        smtp_password=settings.SMTP_PASSWORD,
        sender_email=settings.SENDER_EMAIL
    )

def send_status_email(
    candidate_email: str,
    candidate_name: str,
    job_title: str,
    from_status: str,
    to_status: str,
    interview_date: Optional[str] = None,
    interview_link: Optional[str] = None,
    offer_details: Optional[str] = None,
) -> bool:
    """
    Sends an automated email to a candidate when their hiring status changes.
    """
    # 1. Validate candidate email exists and is non-null
    if not candidate_email or not candidate_email.strip():
        logger.warning(
            f"Cannot send status email: email is null, empty or invalid for candidate '{candidate_name}' "
            f"(transitioning from {from_status} to {to_status} for job '{job_title}')."
        )
        return False

    # 2. Determine trigger and map to template/subject
    if to_status == "Rejected":
        template_name = "any_to_rejected.html"
        subject = "Thank you for your interest"
    elif from_status == "Applied" and to_status == "Under Review":
        template_name = "applied_to_under_review.html"
        subject = "We received your application"
    elif from_status == "Under Review" and to_status == "Shortlisted":
        template_name = "under_review_to_shortlisted.html"
        subject = "Great news! You've been shortlisted"
    elif from_status in ["Shortlisted", "Interviewing"] and to_status == "Interviewing":
        template_name = "shortlisted_to_interviewing.html"
        subject = f"Interview scheduled for {job_title}"
    elif from_status == "Interviewing" and to_status == "Selected":
        template_name = "interviewing_to_selected.html"
        subject = f"Offer: {job_title}"
    else:
        # Fallback template warning
        logger.warning(
            f"No email template or trigger defined for candidate status transition from '{from_status}' "
            f"to '{to_status}' (candidate: '{candidate_name}', email: '{candidate_email}', job: '{job_title}')."
        )
        return False

    # 3. Render Jinja2 Template
    try:
        template = env.get_template(template_name)
        html_content = template.render(
            candidate_name=candidate_name,
            job_title=job_title,
            interview_date=interview_date,
            interview_link=interview_link,
            offer_details=offer_details
        )
    except Exception as e:
        logger.error(f"Failed to load or render email template '{template_name}' for transition '{from_status}' -> '{to_status}': {e}")
        return False

    # 4. Deliver email using the active provider
    provider = get_email_provider()
    return provider.send_email(
        to_email=candidate_email,
        subject=subject,
        html_content=html_content
    )


ASSESSMENT_TEMPLATE_LABELS = {
    "POWER_PLATFORM": "Power Platform Assessment",
    "SQL": "SQL Developer Assessment",
    "ORACLE_EPM": "Oracle EPM Assessment",
}


def get_assessment_display_name(assessment_template: Optional[str]) -> str:
    """Return a human-readable assessment name for email content."""
    if not assessment_template:
        return "Skills Assessment"
    return ASSESSMENT_TEMPLATE_LABELS.get(assessment_template, assessment_template.replace("_", " ").title())


def send_assessment_invitation_email(
    candidate_email: str,
    candidate_name: str,
    job_title: str,
    assessment_name: str,
    moodle_url: str,
    moodle_username: str,
    moodle_temp_password: str,
    passing_score: int,
) -> bool:
    """Send a Moodle assessment invitation email to a candidate."""
    if not candidate_email or not candidate_email.strip():
        logger.warning(
            "Cannot send assessment invitation: email is missing for candidate '%s' (job '%s').",
            candidate_name,
            job_title,
        )
        return False

    if not moodle_username or not moodle_temp_password:
        logger.warning(
            "Cannot send assessment invitation: Moodle credentials are missing for candidate '%s' (job '%s').",
            candidate_name,
            job_title,
        )
        return False

    subject = f"Assessment Invitation - {job_title}"

    try:
        template = env.get_template("assessment_invitation.html")
        html_content = template.render(
            candidate_name=candidate_name,
            job_title=job_title,
            assessment_name=assessment_name,
            moodle_url=moodle_url.rstrip("/"),
            moodle_username=moodle_username,
            moodle_temp_password=moodle_temp_password,
            passing_score=passing_score,
        )
    except Exception as exc:
        logger.error(
            "Failed to load or render assessment invitation template for candidate '%s': %s",
            candidate_name,
            exc,
        )
        return False

    provider = get_email_provider()
    sent = provider.send_email(
        to_email=candidate_email.strip(),
        subject=subject,
        html_content=html_content,
    )
    if sent:
        logger.info(
            "Assessment invitation email sent to '%s' for job '%s'.",
            candidate_email,
            job_title,
        )
    else:
        logger.error(
            "Failed to send assessment invitation email to '%s' for job '%s'.",
            candidate_email,
            job_title,
        )
    return sent
