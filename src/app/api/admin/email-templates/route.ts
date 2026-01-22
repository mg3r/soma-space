import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

type EmailTemplate = {
  id?: string;
  name: string;
  subject: string;
  body: string;
  created_at?: string;
  updated_at?: string;
};

// GET - List all templates
export async function GET() {
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase not configured" },
      { status: 500 }
    );
  }

  try {
    const { data, error } = await supabase
      .from("email_templates")
      .select("*")
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("Error fetching email templates:", error);
      return NextResponse.json(
        { error: "Failed to fetch templates" },
        { status: 500 }
      );
    }

    return NextResponse.json({ templates: data || [] });
  } catch (error) {
    console.error("Error in GET email templates:", error);
    return NextResponse.json(
      { error: "Failed to fetch templates" },
      { status: 500 }
    );
  }
}

// POST - Create a new template
export async function POST(req: Request) {
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase not configured" },
      { status: 500 }
    );
  }

  try {
    const body: EmailTemplate = await req.json();
    const { name, subject, body: emailBody } = body;

    if (!name || !subject || !emailBody) {
      return NextResponse.json(
        { error: "name, subject, and body are required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("email_templates")
      .insert({
        name: name.trim(),
        subject: subject.trim(),
        body: emailBody,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating email template:", error);
      return NextResponse.json(
        { error: "Failed to create template" },
        { status: 500 }
      );
    }

    return NextResponse.json({ template: data });
  } catch (error) {
    console.error("Error in POST email templates:", error);
    return NextResponse.json(
      { error: "Failed to create template" },
      { status: 500 }
    );
  }
}

// PUT - Update an existing template
export async function PUT(req: Request) {
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase not configured" },
      { status: 500 }
    );
  }

  try {
    const body: EmailTemplate & { id: string } = await req.json();
    const { id, name, subject, body: emailBody } = body;

    if (!id || !name || !subject || !emailBody) {
      return NextResponse.json(
        { error: "id, name, subject, and body are required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("email_templates")
      .update({
        name: name.trim(),
        subject: subject.trim(),
        body: emailBody,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating email template:", error);
      return NextResponse.json(
        { error: "Failed to update template" },
        { status: 500 }
      );
    }

    return NextResponse.json({ template: data });
  } catch (error) {
    console.error("Error in PUT email templates:", error);
    return NextResponse.json(
      { error: "Failed to update template" },
      { status: 500 }
    );
  }
}

// DELETE - Delete a template
export async function DELETE(req: Request) {
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase not configured" },
      { status: 500 }
    );
  }

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "id parameter is required" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("email_templates")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting email template:", error);
      return NextResponse.json(
        { error: "Failed to delete template" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in DELETE email templates:", error);
    return NextResponse.json(
      { error: "Failed to delete template" },
      { status: 500 }
    );
  }
}
