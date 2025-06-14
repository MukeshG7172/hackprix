import os
import json
from typing import Dict, Any, List, Optional, Tuple
import pandas as pd
import gradio as gr
from nl2sql_rag import NL2SQLRAGConverter

# Global converter instance
converter = None

def initialize_converter():
    """Initialize the NL2SQL converter with database configuration"""
    global converter
    
    db_config = {
        'host': 'ep-falling-sky-a8r9jwvy-pooler.eastus2.azure.neon.tech',
        'database': 'neondb',
        'user': 'neondb_owner',
        'password': 'npg_5LS7pKYICxmZ',
        'port': 5432,
        'sslmode': 'require'
    }
    
    try:
        print("🔄 Initializing NL2SQL converter with RAG...")
        converter = NL2SQLRAGConverter(db_config, model_name="llama3.2:latest")
        print("✅ NL2SQL Converter with RAG initialized successfully!")
        return "✅ NL2SQL Converter with RAG initialized successfully!\n📚 Knowledge base loaded and ready."
    except Exception as e:
        error_msg = f"❌ Failed to initialize converter: {str(e)}"
        print(error_msg)
        return error_msg

def process_question(question: str) -> Tuple[str, str, str, str]:
    """Process natural language question and return results with RAG context"""
    global converter
    
    if not converter:
        return "❌ Please initialize the converter first", "", "", ""
    
    if not question.strip():
        return "❌ Please enter a question", "", "", ""
    
    try:
        print(f"🔍 Processing question: {question}")
        result = converter.query(question)
        
        # Format SQL query for display
        sql_display = f"```sql\n{result['sql_query']}\n```"
        
        # Format results as a table if possible
        results_display = ""
        if result['results']:
            if len(result['results']) <= 20:  # Show limited results
                try:
                    df = pd.DataFrame(result['results'])
                    results_display = df.to_string(index=False)
                except:
                    results_display = json.dumps(result['results'], indent=2, default=str)
            else:
                results_display = f"Query returned {len(result['results'])} rows (showing first 20):\n"
                try:
                    df = pd.DataFrame(result['results'][:20])
                    results_display += df.to_string(index=False)
                except:
                    results_display += json.dumps(result['results'][:20], indent=2, default=str)
        else:
            results_display = "No results found"
        
        # Format RAG context
        rag_context_display = ""
        if result.get('rag_context'):
            rag_context_display = f"📚 **RAG Context Used:**\n\n{result['rag_context'][:1000]}..."
        else:
            rag_context_display = "No RAG context retrieved"
        
        return result['answer'], sql_display, results_display, rag_context_display
        
    except Exception as e:
        error_msg = f"❌ Error processing question: {str(e)}"
        print(error_msg)
        return error_msg, "", "", ""

def add_knowledge_to_rag(knowledge_content: str, knowledge_type: str = "custom") -> str:
    """Add new knowledge to the RAG system"""
    global converter
    
    if not converter:
        return "❌ Please initialize the converter first"
    
    if not knowledge_content.strip():
        return "❌ Please enter knowledge content"
    
    try:
        metadata = {
            "source": "user_added",
            "type": knowledge_type,
            "timestamp": pd.Timestamp.now().isoformat()
        }
        
        result = converter.add_knowledge(knowledge_content, metadata)
        return result
        
    except Exception as e:
        return f"❌ Failed to add knowledge: {str(e)}"

def get_example_questions():
    """Return example questions for testing"""
    return [
        "Show me all students from CSE department",
        "What is the average LeetCode rating of all students?",
        "Who has the highest Codeforces rating?",
        "List students who participated in contests on LEETCODE platform",
        "How many students are there in each department?",
        "Show me students with LeetCode rating above 1500",
        "Find students who have solved more than 100 LeetCode problems",
        "What are the top 5 students by Codeforces rating?",
        "Compare average ratings across all platforms",
        "Show me recent contest participants from the last month"
    ]

def get_sample_knowledge():
    """Return sample knowledge that can be added to RAG"""
    return [
        """
        Academic Department Information:
        - CSE: Computer Science and Engineering
        - ECE: Electronics and Communication Engineering
        - ME: Mechanical Engineering
        - EEE: Electrical and Electronics Engineering
        
        Common rating ranges:
        - LeetCode: 1000-3000 (Expert level: 2100+)
        - Codeforces: 800-3500 (Expert level: 1600+)
        - CodeChef: 1000-3000 (Expert level: 2000+)
        """,
        
        """
        Contest Performance Analysis:
        
        To analyze contest performance:
        1. Look at contest rank and participation
        2. Consider the platform (different difficulty levels)
        3. Check contest dates for recent activity
        4. Compare performance across multiple contests
        
        Good performance indicators:
        - Consistent participation across platforms
        - Improving ratings over time
        - High problem-solving count
        - Low contest ranks (better performance)
        """,
        
        """
        Student Performance Metrics:
        
        Key performance indicators:
        1. Rating consistency across platforms
        2. Problem-solving volume (leetcodeproblemcount)
        3. Contest participation frequency
        4. Department-wise performance comparison
        
        Query patterns for analysis:
        - Cross-platform rating correlation
        - Department-wise average performance
        - Active vs inactive student identification
        - Performance trends over time
        """
    ]

# Create Gradio interface
def create_gradio_app():
    """Create and configure the Gradio interface with RAG features"""
    
    with gr.Blocks(
        title="NL2SQL with RAG System",
        theme=gr.themes.Soft(),
        css="""
        .main-header {
            text-align: center;
            background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 2rem;
            border-radius: 10px;
            margin-bottom: 2rem;
        }
        .example-box {
            background-color: #f8f9fa;
            padding: 1rem;
            border-radius: 8px;
            border-left: 4px solid #667eea;
        }
        .rag-section {
            background-color: #f0f8ff;
            padding: 1rem;
            border-radius: 8px;
            border-left: 4px solid #4169e1;
        }
        """
    ) as app:
        
        # Header
        gr.HTML("""
            <div class="main-header">
                <h1>🤖 Natural Language to SQL with RAG System</h1>
                <p>Ask questions about student records in plain English with enhanced AI assistance!</p>
                <p>✨ Now with Retrieval-Augmented Generation (RAG) for better query understanding</p>
            </div>
        """)
        
        # Initialization section
        with gr.Row():
            with gr.Column():
                gr.Markdown("## 🚀 System Initialization")
                init_btn = gr.Button("Initialize NL2SQL + RAG System", variant="primary", size="lg")
                init_status = gr.Textbox(
                    label="Initialization Status",
                    interactive=False,
                    show_label=True,
                    lines=3
                )
        
        # Main query interface
        gr.Markdown("## 💬 Ask Your Question")
        
        with gr.Row():
            with gr.Column(scale=2):
                question_input = gr.Textbox(
                    label="Enter your question in plain English",
                    placeholder="e.g., What is the average LeetCode rating of CSE students?",
                    lines=2
                )
                
                with gr.Row():
                    submit_btn = gr.Button("🔍 Submit Question", variant="primary")
                    clear_btn = gr.Button("🗑️ Clear", variant="secondary")
            
            with gr.Column(scale=1):
                gr.Markdown("### 📝 Example Questions")
                example_questions = get_example_questions()
                for i, example in enumerate(example_questions[:5]):  # Show first 5 examples
                    gr.Button(
                        example,
                        variant="outline",
                        size="sm"
                    ).click(
                        lambda x=example: x,
                        outputs=question_input
                    )
        
        # Results section
        gr.Markdown("## 📊 Results")
        
        with gr.Row():
            with gr.Column():
                answer_output = gr.Textbox(
                    label="🤖 Natural Language Answer",
                    lines=6,
                    interactive=False
                )
            
        with gr.Row():
            with gr.Column():
                sql_output = gr.Code(
                    label="🔧 Generated SQL Query",
                    language="sql",
                    interactive=False
                )
            
            with gr.Column():
                results_output = gr.Code(
                    label="📋 Query Results",
                    language="json",
                    interactive=False
                )
        
        # RAG Context Display
        with gr.Row():
            with gr.Column():
                rag_context_output = gr.Markdown(
                    label="📚 RAG Context Used",
                    value="No context retrieved yet"
                )
        
        # RAG Knowledge Management Section
        gr.Markdown("## 🧠 RAG Knowledge Management")
        
        with gr.Accordion("📚 Add Knowledge to RAG System", open=False):
            gr.HTML("""
                <div class="rag-section">
                    <h4>Enhance the AI's understanding by adding domain-specific knowledge:</h4>
                    <p>You can add SQL examples, database documentation, or domain knowledge to improve query generation.</p>
                </div>
            """)
            
            with gr.Row():
                with gr.Column(scale=2):
                    knowledge_input = gr.Textbox(
                        label="Knowledge Content",
                        placeholder="Enter domain knowledge, SQL examples, or documentation...",
                        lines=5
                    )
                    
                    knowledge_type = gr.Dropdown(
                        label="Knowledge Type",
                        choices=["sql_examples", "database_docs", "domain_knowledge", "custom"],
                        value="custom"
                    )
                    
                    add_knowledge_btn = gr.Button("📚 Add Knowledge", variant="secondary")
                    knowledge_status = gr.Textbox(
                        label="Knowledge Addition Status",
                        interactive=False,
                        lines=2
                    )
                
                with gr.Column(scale=1):
                    gr.Markdown("### 📖 Sample Knowledge")
                    sample_knowledge = get_sample_knowledge()
                    for i, sample in enumerate(sample_knowledge):
                        gr.Button(
                            f"Sample {i+1}: {'Department Info' if i==0 else 'Contest Analysis' if i==1 else 'Performance Metrics'}",
                            variant="outline",
                            size="sm"
                        ).click(
                            lambda x=sample: x,
                            outputs=knowledge_input
                        )
        
        # More examples section
        with gr.Accordion("📚 More Example Questions", open=False):
            gr.HTML("""
                <div class="example-box">
                    <h4>Try these example questions:</h4>
                    <ul>
                        <li>"Show me all students from CSE department"</li>
                        <li>"What is the average LeetCode rating of all students?"</li>
                        <li>"Who has the highest Codeforces rating?"</li>
                        <li>"List students who participated in contests on LEETCODE platform"</li>
                        <li>"How many students are there in each department?"</li>
                        <li>"Show me students with LeetCode rating above 1500"</li>
                        <li>"Find students who have solved more than 100 LeetCode problems"</li>
                        <li>"What are the top 5 students by Codeforces rating?"</li>
                        <li>"Compare average ratings across all platforms by department"</li>
                        <li>"Show me recent contest participants from the last month"</li>
                        <li>"Which students are active on multiple platforms?"</li>
                        <li>"Find the most improved students based on contest rankings"</li>
                    </ul>
                </div>
            """)
        
        # Database schema information
        with gr.Accordion("🗂️ Database Schema Information", open=False):
            gr.Code(
                """
                Table: StudentRecord
                Columns:
                - id: TEXT (Primary Key, UUID)
                - studentid: TEXT (Student identifier)
                - leetcodeid: TEXT (LeetCode username)
                - codeforcesid: TEXT (Codeforces username)
                - codechefid: TEXT (CodeChef username)
                - leetcoderating: INTEGER (LeetCode rating)
                - codeforcesrating: INTEGER (Codeforces rating)
                - codechefrating: INTEGER (CodeChef rating)
                - leetcodeproblemcount: INTEGER (Number of problems solved on LeetCode)
                - department: TEXT (Academic department)
                - batch: TEXT (Academic batch/year)
                - platform: Platform ENUM ('LEETCODE', 'CODEFORCES', 'CODECHEF')
                - contestname: TEXT (Contest name)
                - contestrank: INTEGER (Rank in contest)
                - contestdate: TIMESTAMP WITH TIME ZONE (Contest date)
                - createdat: TIMESTAMP WITH TIME ZONE (Record creation time)
                - updatedat: TIMESTAMP WITH TIME ZONE (Record update time)
                
                Important Notes:
                - Use double quotes for table and column names
                - Platform enum values: 'LEETCODE', 'CODEFORCES', 'CODECHEF'
                - Rating fields can be NULL
                - Date fields use TIMESTAMP WITH TIME ZONE format
                """,
                language="sql"
            )
        
        # System Information
        with gr.Accordion("⚙️ System Information", open=False):
            gr.Markdown("""
            ### 🔧 Technical Components
            
            **RAG System:**
            - **Vector Database:** ChromaDB (persistent, local storage)
            - **Embeddings:** Ollama nomic-embed-text model
            - **Knowledge Base:** SQL documentation, examples, and best practices
            
            **NL2SQL Pipeline:**
            - **LLM:** Ollama Llama 3.2 (free, local)
            - **Workflow:** LangGraph state management
            - **Database:** PostgreSQL with proper error handling
            
            **Features:**
            - ✅ Context-aware query generation
            - ✅ Intelligent error handling with suggestions
            - ✅ Knowledge base expansion
            - ✅ Multi-step reasoning with RAG
            - ✅ Persistent vector storage
            
            ### 📋 Requirements
            ```bash
            # Install required packages
            pip install gradio psycopg2-binary pandas langchain-community 
            pip install ollama langgraph chromadb
            
            # Install and setup Ollama
            curl -fsSL https://ollama.ai/install.sh | sh
            ollama pull llama3.2:latest
            ollama pull nomic-embed-text:latest
            ```
            """)
        
        # Event handlers
        init_btn.click(
            fn=initialize_converter,
            outputs=[init_status]
        )
        
        submit_btn.click(
            fn=process_question,
            inputs=[question_input],
            outputs=[answer_output, sql_output, results_output, rag_context_output]
        )
        
        add_knowledge_btn.click(
            fn=add_knowledge_to_rag,
            inputs=[knowledge_input, knowledge_type],
            outputs=[knowledge_status]
        )
        
        clear_btn.click(
            lambda: ("", "", "", "", ""),
            outputs=[question_input, answer_output, sql_output, results_output, rag_context_output]
        )
        
        # Enter key support
        question_input.submit(
            fn=process_question,
            inputs=[question_input],
            outputs=[answer_output, sql_output, results_output, rag_context_output]
        )
    
    return app

# Main function to run the app
def main():
    """Main function to launch the Gradio app"""
    print("🚀 Starting Natural Language to SQL Query System with RAG...")
    print("📋 Make sure you have:")
    print("   - Ollama installed and running")
    print("   - llama3.2:latest model pulled (ollama pull llama3.2:latest)")
    print("   - nomic-embed-text:latest model pulled (ollama pull nomic-embed-text:latest)")
    print("   - Database accessible")
    print("   - All required packages installed")
    print("   - ChromaDB will be initialized automatically")
    print()
    
    app = create_gradio_app()
    
    # Launch the app
    app.launch(
        server_name="127.0.0.1",  # Change to "0.0.0.0" to make it accessible externally
        server_port=7862,
        share=False,  # Set to True to create a public link
        debug=True,
        show_error=True
    )

if __name__ == "__main__":
    # Required packages installation command:
    """
    pip install gradio psycopg2-binary pandas langchain-community ollama langgraph chromadb
    
    # Ollama setup:
    curl -fsSL https://ollama.ai/install.sh | sh
    ollama pull llama3.2:latest
    ollama pull nomic-embed-text:latest
    """
    
    main()