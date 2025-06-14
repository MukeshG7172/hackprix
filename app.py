import streamlit as st
import os
import json
import pandas as pd
from typing import Dict, Any, List, Optional
from datetime import datetime
import psycopg2
from psycopg2.extras import RealDictCursor
from langchain_community.llms import Ollama
from langchain.prompts import PromptTemplate
from langchain.schema import BaseOutputParser
from langgraph.graph import Graph, StateGraph, END
from typing_extensions import TypedDict, Annotated
import plotly.express as px
import plotly.graph_objects as go

# Page configuration
st.set_page_config(
    page_title="NL2SQL Converter",
    page_icon="🤖",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Custom CSS
st.markdown("""
<style>
    .main-header {
        font-size: 3rem;
        font-weight: bold;
        text-align: center;
        margin-bottom: 2rem;
        background: linear-gradient(90deg, #4CAF50, #2196F3);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
    }
    .sql-box {
        background-color: #f0f2f6;
        padding: 1rem;
        border-radius: 10px;
        border-left: 4px solid #4CAF50;
        margin: 1rem 0;
    }
    .error-box {
        background-color: #ffebee;
        padding: 1rem;
        border-radius: 10px;
        border-left: 4px solid #f44336;
        margin: 1rem 0;
    }
    .success-box {
        background-color: #e8f5e8;
        padding: 1rem;
        border-radius: 10px;
        border-left: 4px solid #4CAF50;
        margin: 1rem 0;
    }
</style>
""", unsafe_allow_html=True)

# State definition for LangGraph
class NL2SQLState(TypedDict):
    question: str
    sql_query: str
    query_result: List[Dict[str, Any]]
    final_answer: str
    error: Optional[str]

class SQLQueryParser(BaseOutputParser):
    """Custom parser to extract SQL query from LLM response"""
    
    def parse(self, text: str) -> str:
        text = text.strip()
        
        if "```sql" in text.lower():
            start = text.lower().find("```sql") + 6
            end = text.find("```", start)
            if end != -1:
                return text[start:end].strip()
        elif "```" in text:
            start = text.find("```") + 3
            end = text.find("```", start)
            if end != -1:
                return text[start:end].strip()
        
        sql_keywords = ['SELECT', 'INSERT', 'UPDATE', 'DELETE']
        for keyword in sql_keywords:
            if keyword in text.upper():
                lines = text.split('\n')
                sql_lines = []
                capturing = False
                for line in lines:
                    if any(kw in line.upper() for kw in sql_keywords):
                        capturing = True
                    if capturing:
                        sql_lines.append(line)
                        if line.strip().endswith(';'):
                            break
                return '\n'.join(sql_lines).strip()
        
        return text.strip()

@st.cache_resource
def get_nl2sql_converter():
    """Initialize and cache the NL2SQL converter"""
    return NL2SQLConverter(st.session_state.db_config)

class NL2SQLConverter:
    def __init__(self, db_config: Dict[str, str], model_name: str = "llama3.1"):
        self.db_config = db_config
        self.llm = Ollama(model=model_name, temperature=0)
        self.sql_parser = SQLQueryParser()
        
        self.schema_info = """
        Database Schema for StudentRecord table:
        
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
        """
        
        self.graph = self.create_graph()
    
    def create_graph(self) -> StateGraph:
        workflow = StateGraph(NL2SQLState)
        
        workflow.add_node("generate_sql", self.generate_sql_query)
        workflow.add_node("execute_query", self.execute_sql_query)
        workflow.add_node("generate_answer", self.generate_natural_answer)
        workflow.add_node("handle_error", self.handle_error)
        
        workflow.set_entry_point("generate_sql")
        workflow.add_edge("generate_sql", "execute_query")
        workflow.add_conditional_edges(
            "execute_query",
            self.should_handle_error,
            {
                "error": "handle_error",
                "success": "generate_answer"
            }
        )
        workflow.add_edge("generate_answer", END)
        workflow.add_edge("handle_error", END)
        
        return workflow.compile()
    
    def generate_sql_query(self, state: NL2SQLState) -> NL2SQLState:
        prompt = PromptTemplate(
            template="""
            You are a SQL expert. Convert the following natural language question into a SQL query.
            
            {schema_info}
            
            Question: {question}
            
            Important guidelines:
            1. Use double quotes for table and column names (e.g., "StudentRecord", "studentId")
            2. For Platform enum, use values: 'LEETCODE', 'CODEFORCES', 'CODECHEF'
            3. Write efficient queries with proper WHERE clauses when needed
            4. Use appropriate aggregation functions (COUNT, AVG, MAX, MIN, SUM) when needed
            5. For date comparisons, use proper TIMESTAMP formatting
            6. Return only the SQL query, no explanations
            
            SQL Query:
            """,
            input_variables=["schema_info", "question"]
        )
        
        try:
            formatted_prompt = prompt.format(
                schema_info=self.schema_info,
                question=state["question"]
            )
            
            response = self.llm.invoke(formatted_prompt)
            sql_query = self.sql_parser.parse(response)
            
            return {**state, "sql_query": sql_query}
        except Exception as e:
            return {**state, "error": f"Failed to generate SQL query: {str(e)}"}
    
    def execute_sql_query(self, state: NL2SQLState) -> NL2SQLState:
        try:
            conn = psycopg2.connect(**self.db_config)
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            
            cursor.execute(state["sql_query"])
            
            if state["sql_query"].strip().upper().startswith("SELECT"):
                results = cursor.fetchall()
                query_result = [dict(row) for row in results]
            else:
                conn.commit()
                query_result = [{"affected_rows": cursor.rowcount}]
            
            cursor.close()
            conn.close()
            
            return {**state, "query_result": query_result}
            
        except Exception as e:
            return {**state, "error": f"SQL execution error: {str(e)}"}
    
    def should_handle_error(self, state: NL2SQLState) -> str:
        return "error" if state.get("error") else "success"
    
    def handle_error(self, state: NL2SQLState) -> NL2SQLState:
        error_msg = state.get("error", "Unknown error occurred")
        
        final_answer = f"""
        ❌ I encountered an error while processing your question: {error_msg}
        
        Please try rephrasing your question or check if:
        1. The question refers to valid table columns
        2. The question is clear and specific
        3. Any date formats are reasonable
        
        💡 Example questions you can ask:
        - "Show me all students from CSE department"
        - "What is the average LeetCode rating?"
        - "Who has the highest Codeforces rating?"
        - "List students who participated in contests on LEETCODE platform"
        """
        
        return {**state, "final_answer": final_answer}
    
    def generate_natural_answer(self, state: NL2SQLState) -> NL2SQLState:
        prompt = PromptTemplate(
            template="""
            You are a helpful assistant that explains database query results in natural language.
            
            Original Question: {question}
            SQL Query Used: {sql_query}
            Query Results: {query_result}
            
            Please provide a clear, natural language answer to the original question based on the query results.
            
            Guidelines:
            1. Be concise and direct
            2. Include relevant numbers and statistics
            3. If no results found, explain that clearly
            4. Format the response in a user-friendly way
            5. Don't mention technical database details unless relevant
            
            Answer:
            """,
            input_variables=["question", "sql_query", "query_result"]
        )
        
        try:
            formatted_prompt = prompt.format(
                question=state["question"],
                sql_query=state["sql_query"],
                query_result=json.dumps(state["query_result"], indent=2, default=str)
            )
            
            response = self.llm.invoke(formatted_prompt)
            final_answer = response.strip()
            
            return {**state, "final_answer": final_answer}
            
        except Exception as e:
            return {**state, "final_answer": f"Generated results but failed to create natural language response: {str(e)}"}
    
    def query(self, question: str) -> Dict[str, Any]:
        initial_state = NL2SQLState(
            question=question,
            sql_query="",
            query_result=[],
            final_answer="",
            error=None
        )
        
        result = self.graph.invoke(initial_state)
        
        return {
            "question": result["question"],
            "sql_query": result["sql_query"],
            "results": result["query_result"],
            "answer": result["final_answer"],
            "error": result.get("error")
        }

def init_session_state():
    """Initialize session state variables"""
    if 'db_config' not in st.session_state:
        st.session_state.db_config = {
            'host': 'localhost',
            'database': '',
            'user': '',
            'password': '',
            'port': '5432'
        }
    
    if 'query_history' not in st.session_state:
        st.session_state.query_history = []

def create_visualization(df, chart_type):
    """Create visualizations based on data"""
    if df.empty:
        return None
    
    # Detect numeric columns
    numeric_cols = df.select_dtypes(include=['int64', 'float64']).columns.tolist()
    text_cols = df.select_dtypes(include=['object']).columns.tolist()
    
    if not numeric_cols and not text_cols:
        return None
    
    try:
        if chart_type == "Bar Chart" and text_cols and numeric_cols:
            fig = px.bar(df, x=text_cols[0], y=numeric_cols[0], 
                        title=f"{numeric_cols[0]} by {text_cols[0]}")
        elif chart_type == "Line Chart" and len(numeric_cols) >= 2:
            fig = px.line(df, x=numeric_cols[0], y=numeric_cols[1], 
                         title=f"{numeric_cols[1]} vs {numeric_cols[0]}")
        elif chart_type == "Scatter Plot" and len(numeric_cols) >= 2:
            fig = px.scatter(df, x=numeric_cols[0], y=numeric_cols[1], 
                           title=f"{numeric_cols[1]} vs {numeric_cols[0]}")
        elif chart_type == "Histogram" and numeric_cols:
            fig = px.histogram(df, x=numeric_cols[0], 
                             title=f"Distribution of {numeric_cols[0]}")
        else:
            return None
        
        return fig
    except Exception:
        return None

def main():
    init_session_state()
    
    # Header
    st.markdown('<h1 class="main-header">🤖 Natural Language to SQL Converter</h1>', 
                unsafe_allow_html=True)
    
    # Sidebar for database configuration
    with st.sidebar:
        st.header("⚙️ Database Configuration")
        
        st.session_state.db_config['host'] = st.text_input(
            "Host", value=st.session_state.db_config['host']
        )
        st.session_state.db_config['database'] = st.text_input(
            "Database", value=st.session_state.db_config['database']
        )
        st.session_state.db_config['user'] = st.text_input(
            "Username", value=st.session_state.db_config['user']
        )
        st.session_state.db_config['password'] = st.text_input(
            "Password", value=st.session_state.db_config['password'], type="password"
        )
        st.session_state.db_config['port'] = st.text_input(
            "Port", value=st.session_state.db_config['port']
        )
        
        # Model selection
        st.header("🔧 Model Settings")
        model_name = st.selectbox(
            "Select Ollama Model",
            ["llama3.1", "codellama", "llama2", "mistral"],
            index=0
        )
        
        # Test connection
        if st.button("🔗 Test Connection"):
            try:
                conn = psycopg2.connect(**st.session_state.db_config)
                conn.close()
                st.success("✅ Connection successful!")
            except Exception as e:
                st.error(f"❌ Connection failed: {str(e)}")
        
        # Example questions
        st.header("💡 Example Questions")
        example_questions = [
            "Show me all students from CSE department",
            "What is the average LeetCode rating?",
            "Who has the highest Codeforces rating?",
            "List students with rating above 1500",
            "How many students in each department?",
            "Show recent contests in last 30 days"
        ]
        
        for q in example_questions:
            if st.button(f"📝 {q}", key=f"example_{q}"):
                st.session_state.current_question = q
    
    # Main interface
    col1, col2 = st.columns([2, 1])
    
    with col1:
        st.header("🎯 Ask Your Question")
        
        # Question input
        question = st.text_area(
            "Enter your question in natural language:",
            value=st.session_state.get('current_question', ''),
            height=100,
            placeholder="e.g., Show me all students from CSE department with LeetCode rating above 1500"
        )
        
        # Action buttons
        col_btn1, col_btn2, col_btn3 = st.columns([1, 1, 2])
        
        with col_btn1:
            process_btn = st.button("🚀 Process Query", type="primary")
        
        with col_btn2:
            clear_btn = st.button("🗑️ Clear")
        
        if clear_btn:
            st.session_state.current_question = ""
            st.rerun()
    
    with col2:
        st.header("📊 Quick Stats")
        if st.session_state.query_history:
            st.metric("Total Queries", len(st.session_state.query_history))
            successful_queries = sum(1 for q in st.session_state.query_history if not q.get('error'))
            st.metric("Successful Queries", successful_queries)
            st.metric("Success Rate", f"{(successful_queries/len(st.session_state.query_history)*100):.1f}%")
    
    # Process query
    if process_btn and question.strip():
        if not all(st.session_state.db_config.values()):
            st.error("❌ Please configure database settings in the sidebar first!")
            return
        
        with st.spinner("🔄 Processing your question..."):
            try:
                # Initialize converter
                converter = NL2SQLConverter(st.session_state.db_config, model_name)
                
                # Process query
                result = converter.query(question)
                
                # Store in history
                st.session_state.query_history.append({
                    'timestamp': datetime.now(),
                    'question': question,
                    'result': result
                })
                
                # Display results
                st.header("📋 Results")
                
                # SQL Query
                st.subheader("🔍 Generated SQL Query")
                st.markdown(f'<div class="sql-box"><code>{result["sql_query"]}</code></div>', 
                           unsafe_allow_html=True)
                
                # Error handling
                if result["error"]:
                    st.markdown(f'<div class="error-box"><strong>Error:</strong> {result["error"]}</div>', 
                               unsafe_allow_html=True)
                else:
                    # Success message
                    st.markdown(f'<div class="success-box"><strong>Query executed successfully!</strong> Found {len(result["results"])} results.</div>', 
                               unsafe_allow_html=True)
                    
                    # Natural language answer
                    st.subheader("🤖 AI Answer")
                    st.write(result["answer"])
                    
                    # Data table
                    if result["results"]:
                        st.subheader("📊 Data Results")
                        
                        # Convert to DataFrame
                        df = pd.DataFrame(result["results"])
                        
                        # Display table
                        st.dataframe(df, use_container_width=True)
                        
                        # Visualization options
                        if len(df) > 1:
                            st.subheader("📈 Data Visualization")
                            
                            chart_type = st.selectbox(
                                "Select Chart Type",
                                ["Bar Chart", "Line Chart", "Scatter Plot", "Histogram"]
                            )
                            
                            fig = create_visualization(df, chart_type)
                            if fig:
                                st.plotly_chart(fig, use_container_width=True)
                            else:
                                st.info("No suitable visualization available for this data.")
                        
                        # Download option
                        csv = df.to_csv(index=False)
                        st.download_button(
                            label="📥 Download Results as CSV",
                            data=csv,
                            file_name=f"query_results_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv",
                            mime="text/csv"
                        )
                
            except Exception as e:
                st.error(f"❌ An error occurred: {str(e)}")
    
    # Query History
    if st.session_state.query_history:
        st.header("📜 Query History")
        
        # Show recent queries
        for i, query in enumerate(reversed(st.session_state.query_history[-5:])):
            with st.expander(f"Query {len(st.session_state.query_history)-i}: {query['question'][:50]}..."):
                st.write(f"**Time:** {query['timestamp'].strftime('%Y-%m-%d %H:%M:%S')}")
                st.write(f"**Question:** {query['question']}")
                st.code(query['result']['sql_query'], language='sql')
                if query['result']['error']:
                    st.error(f"Error: {query['result']['error']}")
                else:
                    st.success(f"Results: {len(query['result']['results'])} rows")

if __name__ == "__main__":
    main()